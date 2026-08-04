import { randomUUID } from 'node:crypto';
import { boundedNumber, optionalText, signed, strings, text } from '../construction/construction-utils.mjs';

const SHA = /^[a-f0-9]{64}$/i;
const KINDS = new Set(['fact', 'assumption', 'blocker', 'artifact', 'ownership', 'belief']);
const PROVENANCE_WEIGHT = Object.freeze({ runtime: 1, test: 0.95, lsp: 0.9, ast: 0.88, trace: 0.86, build: 0.82, git: 0.72, user: 0.68, chat: 0.35, memory: 0.3 });

function normalizeProvenance(value) {
  if (!value || typeof value !== 'object') throw new TypeError('provenance is required');
  const kind = text(value.kind, 'provenance.kind', 64).toLowerCase();
  const receiptSha256 = text(value.receiptSha256, 'provenance.receiptSha256', 64).toLowerCase();
  if (!SHA.test(receiptSha256)) throw new TypeError('provenance receipt SHA-256 is required');
  return Object.freeze({ kind, receiptSha256, source: optionalText(value.source, 2_000) });
}

export class SharedBlackboard {
  constructor({ clock = () => Date.now(), maxEntries = 2_000 } = {}) {
    this.clock = clock;
    this.maxEntries = Math.max(10, Math.min(20_000, Number(maxEntries) || 2_000));
    this.entries = [];
    this.leases = new Map();
    this.nextFence = 1;
  }

  heartbeat({ agentId, ttlMs = 30_000 } = {}) {
    const id = text(agentId, 'agentId', 256);
    const now = Number(this.clock());
    const lease = signed({ schema: 'forge.blackboard-lease.v1', agentId: id, fencingToken: this.nextFence++, issuedAtMs: now, expiresAtMs: now + boundedNumber(ttlMs, 30_000, 100, 3_600_000, 'ttlMs') });
    this.leases.set(id, lease);
    return lease;
  }

  #assertLease(agentId, fencingToken) {
    const lease = this.leases.get(agentId);
    if (!lease || lease.expiresAtMs <= Number(this.clock())) throw new Error(`blackboard lease expired for ${agentId}`);
    if (Number(fencingToken) !== lease.fencingToken) throw new Error(`stale fencing token for ${agentId}`);
    return lease;
  }

  write(input = {}) {
    const agentId = text(input.agentId, 'agentId', 256);
    this.#assertLease(agentId, input.fencingToken);
    const kind = text(input.kind, 'kind', 64).toLowerCase();
    if (!KINDS.has(kind)) throw new TypeError(`unsupported blackboard kind: ${kind}`);
    const key = text(input.key, 'key', 512);
    const valueSummary = text(input.valueSummary, 'valueSummary', 8_000);
    const domain = optionalText(input.domain, 256) || 'general';
    const current = this.entries.filter((entry) => entry.key === key && entry.agentId === agentId).at(-1);
    if (input.expectedVersion !== undefined && Number(input.expectedVersion) !== Number(current?.version ?? 0)) throw new Error(`blackboard version conflict for ${key}`);
    const now = Number(this.clock());
    const ttlMs = input.ttlMs === undefined ? null : boundedNumber(input.ttlMs, 0, 1, 86_400_000, 'ttlMs');
    const base = {
      schema: 'forge.shared-blackboard-entry.v1', entryId: randomUUID(), kind, key, valueSummary,
      artifactSha256: input.artifactSha256 ? text(input.artifactSha256, 'artifactSha256', 64).toLowerCase() : null,
      agentId, domain, confidence: boundedNumber(input.confidence, 0.5, 0, 1, 'confidence'), provenance: normalizeProvenance(input.provenance),
      version: Number(current?.version ?? 0) + 1, fencingToken: Number(input.fencingToken), createdAtMs: now, expiresAtMs: ttlMs === null ? null : now + ttlMs,
      supports: strings(input.supports, 'supports', 100, 512), contradicts: strings(input.contradicts, 'contradicts', 100, 512),
      ownership: Object.freeze({ paths: strings(input.ownership?.paths, 'ownership.paths', 200, 2_000), symbols: strings(input.ownership?.symbols, 'ownership.symbols', 200, 1_000) }),
    };
    if (base.artifactSha256 && !SHA.test(base.artifactSha256)) throw new TypeError('artifact SHA-256 is invalid');
    const entry = signed(base);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    return entry;
  }

  read({ key, agentId, domain, kind, includeExpired = false } = {}) {
    const now = Number(this.clock());
    return Object.freeze(this.entries.filter((entry) => {
      if (!includeExpired && entry.expiresAtMs !== null && entry.expiresAtMs <= now) return false;
      if (key && entry.key !== key) return false;
      if (agentId && entry.agentId !== agentId) return false;
      if (domain && entry.domain !== domain) return false;
      if (kind && entry.kind !== kind) return false;
      return true;
    }));
  }

  resolve(key) {
    const live = this.read({ key: text(key, 'key', 512) });
    const latestByAgent = new Map();
    for (const entry of live) latestByAgent.set(entry.agentId, entry);
    const candidates = [...latestByAgent.values()].sort((a, b) => {
      const left = a.confidence * (PROVENANCE_WEIGHT[a.provenance.kind] ?? 0.5);
      const right = b.confidence * (PROVENANCE_WEIGHT[b.provenance.kind] ?? 0.5);
      return right - left || b.version - a.version || a.agentId.localeCompare(b.agentId);
    });
    if (!candidates.length) return signed({ schema: 'forge.blackboard-resolution.v1', key, status: 'missing', entry: null, candidates: [] });
    const distinct = new Set(candidates.map((entry) => entry.valueSummary));
    if (distinct.size > 1) return signed({ schema: 'forge.blackboard-resolution.v1', key, status: 'conflict', entry: null, candidates });
    return signed({ schema: 'forge.blackboard-resolution.v1', key, status: 'resolved', entry: candidates[0], candidates });
  }

  snapshot() {
    const live = this.read();
    return signed({ schema: 'forge.shared-blackboard-snapshot.v1', entries: live, activeLeases: [...this.leases.values()].filter((lease) => lease.expiresAtMs > Number(this.clock())).map((lease) => ({ agentId: lease.agentId, fencingToken: lease.fencingToken, expiresAtMs: lease.expiresAtMs })), claims: { rawPromptStored: false, rawModelOutputStored: false, hiddenReasoningStored: false, staleWriterAccepted: false } });
  }
}
