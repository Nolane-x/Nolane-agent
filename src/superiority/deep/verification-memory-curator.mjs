import { deepFreeze, nonEmpty, requireSha256, signed } from '../superiority-utils.mjs';

export class VerificationMemoryCurator {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.minimumIndependentSuccesses = Math.max(1, Math.floor(Number(limits.minimumIndependentSuccesses) || 2));
    this.maxItems = Math.max(1, Math.floor(Number(limits.maxItems) || 2_000));
    this.items = new Map();
  }

  propose(input = {}) {
    const memoryId = nonEmpty(input.memoryId, 'memoryId');
    if (this.items.has(memoryId)) throw new Error(`Memory already exists ${memoryId}`);
    const kind = String(input.kind ?? '').toLowerCase();
    if (!['memory', 'skill'].includes(kind)) throw new TypeError('kind must be memory or skill');
    const state = { memoryId, kind, contentHash: requireSha256(input.contentHash, 'contentHash'), provenanceHash: requireSha256(input.provenanceHash, 'provenanceHash'), scope: nonEmpty(input.scope, 'scope'), proposerKey: nonEmpty(input.proposerKey, 'proposerKey'), status: 'candidate', outcomes: [], proposedAtMs: Number(this.clock()), updatedAtMs: Number(this.clock()), tombstone: null };
    this.items.set(memoryId, state);
    while (this.items.size > this.maxItems) this.items.delete(this.items.keys().next().value);
    return this.evaluate(memoryId);
  }

  recordOutcome(memoryId, input = {}) {
    const state = this.#state(memoryId);
    if (input.observed !== true) throw new Error('Memory outcome must be observed');
    if (state.status === 'tombstoned') throw new Error('Tombstoned memory cannot receive outcomes');
    const record = deepFreeze({ observed: true, verified: input.verified === true, criticalFailure: input.criticalFailure === true, effectHash: requireSha256(input.effectHash, 'effectHash'), verifierKey: nonEmpty(input.verifierKey, 'verifierKey'), recordedAtMs: Number(this.clock()) });
    state.outcomes.push(record);
    if (state.outcomes.length > 500) state.outcomes.shift();
    state.updatedAtMs = Number(this.clock());
    return this.evaluate(memoryId);
  }

  evaluate(memoryId) {
    const state = this.#state(memoryId);
    const independentSuccesses = new Set(state.outcomes.filter((item) => item.verified && !item.criticalFailure && item.verifierKey !== state.proposerKey).map((item) => item.verifierKey));
    const failures = state.outcomes.filter((item) => !item.verified).length;
    const criticalFailures = state.outcomes.filter((item) => item.criticalFailure).length;
    const promotable = state.status === 'candidate' && independentSuccesses.size >= this.minimumIndependentSuccesses && criticalFailures === 0;
    return signed({
      schema: 'nolane.superiority.verification-memory.v1', memoryId: state.memoryId, kind: state.kind, contentHash: state.contentHash, provenanceHash: state.provenanceHash,
      scope: state.scope, status: state.status, outcomeCount: state.outcomes.length, independentVerifiedSuccesses: independentSuccesses.size, failures, criticalFailures,
      reliability: state.outcomes.length ? state.outcomes.filter((item) => item.verified && !item.criticalFailure).length / state.outcomes.length : 0,
      promotable, proposedAtMs: state.proposedAtMs, updatedAtMs: state.updatedAtMs,
      claims: { rawContentStored: false, hiddenReasoningStored: false, automaticPromotionAllowed: false },
    });
  }

  promote(memoryId, input = {}) {
    const state = this.#state(memoryId);
    const evaluation = this.evaluate(memoryId);
    if (!evaluation.promotable) throw new Error('Memory is not promotable');
    if (input.approvedByHuman !== true) throw new Error('Memory promotion requires explicit human approval');
    state.status = 'active'; state.updatedAtMs = Number(this.clock());
    return signed({ ...this.evaluate(memoryId), schema: 'nolane.superiority.verification-memory-promotion.v1', actor: nonEmpty(input.actor, 'actor'), approvalReceiptSha256: requireSha256(input.approvalReceiptSha256, 'approvalReceiptSha256') });
  }

  invalidate(memoryId, input = {}) {
    const state = this.#state(memoryId);
    requireSha256(input.sourceHash, 'sourceHash');
    nonEmpty(input.reason, 'reason');
    if (state.status !== 'tombstoned') state.status = 'stale';
    state.updatedAtMs = Number(this.clock());
    return this.evaluate(memoryId);
  }

  tombstone(memoryId, input = {}) {
    const state = this.#state(memoryId);
    if (input.approvedByHuman !== true) throw new Error('Tombstone requires explicit human approval');
    state.status = 'tombstoned'; state.updatedAtMs = Number(this.clock());
    state.tombstone = deepFreeze({ actor: nonEmpty(input.actor, 'actor'), approvalReceiptSha256: requireSha256(input.approvalReceiptSha256, 'approvalReceiptSha256'), reason: nonEmpty(input.reason, 'reason'), atMs: state.updatedAtMs });
    return signed({ ...this.evaluate(memoryId), schema: 'nolane.superiority.verification-memory-tombstone.v1', tombstone: state.tombstone });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.verification-memory-curator.v1', items: [...this.items.keys()].map((id) => this.evaluate(id)).sort((a, b) => a.memoryId.localeCompare(b.memoryId)), minimumIndependentSuccesses: this.minimumIndependentSuccesses, claims: { rawContentStored: false, automaticPromotionAllowed: false, automaticDeletionAllowed: false } }); }
  #state(id) { const key = nonEmpty(id, 'memoryId'); const state = this.items.get(key); if (!state) throw new Error(`Unknown memory ${key}`); return state; }
}
