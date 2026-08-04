import { boundedArray, finite, signed, text, unit } from './world-model-utils.mjs';

const DOMAINS = new Set(['repository', 'build', 'test', 'runtime', 'browser', 'resource', 'security']);
function publicModel(record) {
  return {
    id: record.id, domain: record.domain, version: record.version, reliability: record.reliability,
    cost: { ...record.cost }, failureSignatures: [...record.failureSignatures], outcomeCount: record.outcomeCount,
  };
}
export class WorldModelRegistry {
  constructor({ maxModels = 128 } = {}) { this.maxModels = Math.max(1, Math.floor(finite(maxModels, 128))); this.models = new Map(); this.closed = false; }
  register(input = {}) {
    this.#open();
    const id = text(input.id, 'id', 256); const domain = text(input.domain, 'domain', 64);
    if (!DOMAINS.has(domain)) throw new TypeError(`unsupported world model domain: ${domain}`);
    if (this.models.has(id)) throw new TypeError(`duplicate world model: ${id}`);
    if (this.models.size >= this.maxModels) throw new RangeError(`world model limit exceeded: ${this.maxModels}`);
    if (typeof input.adapter?.rollout !== 'function' && typeof input.adapter !== 'function') throw new TypeError('world model adapter is required');
    const record = {
      id, domain, version: text(input.version, 'version', 64), reliability: unit(input.reliability, 0.5),
      cost: { tokens: Math.max(0, finite(input.cost?.tokens)), rssMbSeconds: Math.max(0, finite(input.cost?.rssMbSeconds)), latencyMs: Math.max(0, finite(input.cost?.latencyMs)) },
      failureSignatures: boundedArray(input.failureSignatures, 64).map((item) => text(item, 'failureSignature', 128)),
      adapter: input.adapter, outcomeCount: 0,
    };
    this.models.set(id, record);
    return signed({ schema: 'forge.world-model-registration.v1', model: publicModel(record), claims: { adapterSerialized: false, selfDeclaredCapabilityAccepted: false } });
  }
  select(input = {}) {
    this.#open();
    const domain = text(input.domain, 'domain', 64); const maxTokens = Math.max(0, finite(input.maxTokens, Number.MAX_SAFE_INTEGER));
    const failureSignature = input.failureSignature ? text(input.failureSignature, 'failureSignature', 128) : null;
    const candidates = [...this.models.values()].filter((model) => model.domain === domain && model.cost.tokens <= maxTokens);
    if (!candidates.length) return signed({ schema: 'forge.world-model-selection.v1', status: 'no-compatible-model', domain, model: null, candidates: [] });
    const scored = candidates.map((model) => {
      const failurePenalty = failureSignature && model.failureSignatures.includes(failureSignature) ? 0.35 : 0;
      const costPenalty = Math.min(0.35, model.cost.tokens / Math.max(1, maxTokens) * 0.2 + model.cost.rssMbSeconds / 10_000);
      return { model, score: model.reliability - failurePenalty - costPenalty };
    }).sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id));
    return signed({ schema: 'forge.world-model-selection.v1', status: 'selected', domain, model: publicModel(scored[0].model), candidates: scored.map((item) => ({ id: item.model.id, score: item.score })) });
  }
  getAdapter(id) { this.#open(); const model = this.models.get(text(id, 'id', 256)); if (!model) throw new RangeError(`unknown world model: ${id}`); return model.adapter; }
  recordOutcome(id, outcome = {}) {
    this.#open(); const model = this.models.get(text(id, 'id', 256)); if (!model) throw new RangeError(`unknown world model: ${id}`);
    if (outcome.verified !== true || !/^[a-f0-9]{64}$/i.test(String(outcome.receiptSha256 ?? ''))) throw new TypeError('verified outcome receipt is required');
    const observation = outcome.success === true ? 1 : 0; const alpha = Math.max(0.02, Math.min(0.25, 1 / (model.outcomeCount + 4)));
    model.reliability = unit(model.reliability * (1 - alpha) + observation * alpha); model.outcomeCount += 1;
    return signed({ schema: 'forge.world-model-outcome.v1', reliability: model.reliability, model: publicModel(model), verifiedOutcomeReceiptSha256: String(outcome.receiptSha256).toLowerCase() });
  }
  snapshot() { return signed({ schema: 'forge.world-model-registry-snapshot.v1', closed: this.closed, models: [...this.models.values()].map(publicModel), claims: { selfDeclaredCapabilityAccepted: false, adaptersSerialized: false } }); }
  close() { this.closed = true; this.models.clear(); return signed({ schema: 'forge.world-model-registry-close.v1', closed: true }); }
  #open() { if (this.closed) throw new Error('world model registry is closed'); }
}
