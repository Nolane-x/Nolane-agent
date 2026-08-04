import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])));
}
function receipt(base) { return freeze({ ...base, receiptSha256: sha256(canonical(base)) }); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function requireVerified(outcome) {
  if (!outcome?.verified || !/^[a-f0-9]{64}$/i.test(String(outcome.verificationReceiptSha256 ?? ''))) throw new TypeError('verified outcome receipt is required');
  return outcome;
}

const MEMORY_ACTIONS = new Set(['ADD', 'UPDATE', 'DELETE', 'RETRIEVE', 'SUMMARIZE', 'NOOP']);
export class GovernedMemoryActionLearner {
  constructor() { this.domains = new Map(); }
  learn({ action, domain, outcome } = {}) {
    const normalized = required(action, 'memory action').toUpperCase();
    if (!MEMORY_ACTIONS.has(normalized)) throw new TypeError(`unsupported memory action: ${normalized}`);
    requireVerified(outcome); const key = required(domain, 'domain');
    const current = this.domains.get(key) ?? new Map(); current.set(normalized, (current.get(normalized) ?? 0) + 1); this.domains.set(key, current);
    return receipt({ schema: 'forge.memory-action-learning.v1', domain: key, action: normalized, outcomeId: String(outcome.outcomeId ?? ''), verificationReceiptSha256: outcome.verificationReceiptSha256 });
  }
  policy(domain) {
    const actions = [...(this.domains.get(String(domain))?.keys() ?? [])].sort();
    return freeze({ schema: 'forge.memory-action-policy.v1', domain: String(domain), actions });
  }
}

export class UserMemoryControl {
  constructor() { this.records = new Map(); this.audit = []; }
  #event(action, id, actor, extra = {}) { const event = receipt({ schema: 'forge.user-memory-control-event.v1', action, id, actor: required(actor, 'actor'), ...extra, sequence: this.audit.length + 1 }); this.audit.push(event); return event; }
  add(record, { actor } = {}) {
    const id = required(record?.id, 'memory id'); if (this.records.has(id)) throw new Error('memory already exists');
    const value = freeze({ ...structuredClone(record), id, state: 'active' }); this.records.set(id, value); const event = this.#event('add', id, actor);
    return freeze({ ...value, receiptSha256: event.receiptSha256 });
  }
  inspect(id) { const value = this.records.get(String(id)); return value ? structuredClone(value) : null; }
  edit(id, patch, { actor } = {}) { const key = String(id); const current = this.records.get(key); if (!current) throw new Error('memory not found'); const next = freeze({ ...structuredClone(current), ...structuredClone(patch), id: key }); this.records.set(key, next); this.#event('edit', key, actor, { fields: Object.keys(patch ?? {}).sort() }); return structuredClone(next); }
  invalidate(id, { actor, reason } = {}) { const key = String(id); const current = this.records.get(key); if (!current) throw new Error('memory not found'); const next = freeze({ ...current, state: 'invalid', invalidationReason: required(reason, 'reason') }); this.records.set(key, next); this.#event('invalidate', key, actor, { reason: next.invalidationReason }); return structuredClone(next); }
  archive(id, { actor } = {}) { const key = String(id); const current = this.records.get(key); if (!current) throw new Error('memory not found'); const next = freeze({ ...current, state: 'archived' }); this.records.set(key, next); this.#event('archive', key, actor); return structuredClone(next); }
  delete(id, { actor } = {}) { const key = String(id); if (!this.records.has(key)) throw new Error('memory not found'); this.records.delete(key); const event = this.#event('delete', key, actor); return freeze({ id: key, state: 'deleted', receiptSha256: event.receiptSha256 }); }
  auditLog() { return freeze([...this.audit]); }
}

export class RepositoryCausalMemory {
  constructor() { this.records = new Map(); }
  record(input, outcome) {
    requireVerified(outcome); const id = required(input?.id, 'causal memory id'); const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    if (!evidence.length || evidence.some((item) => !item.path || !/^[a-f0-9]{64}$/i.test(String(item.sourceHash ?? '')))) throw new TypeError('causal memory evidence is required');
    const base = { schema: 'forge.repository-causal-memory.v1', id, decision: required(input.decision, 'decision'), why: required(input.why, 'why'), alternatives: [...(input.alternatives ?? [])].map(String), evidence: structuredClone(evidence), sourceHash: required(input.sourceHash, 'sourceHash'), branch: required(input.branch, 'branch'), verificationReceiptSha256: outcome.verificationReceiptSha256 };
    const stored = receipt(base); this.records.set(id, stored); return stored;
  }
  get(id, context = {}) { const record = this.records.get(String(id)); if (!record) return null; if (record.sourceHash !== String(context.sourceHash) || record.branch !== String(context.branch)) return null; return structuredClone(record); }
}

export class ProcessTreeBudgetGovernor {
  constructor({ probe } = {}) { if (typeof probe !== 'function') throw new TypeError('process tree probe is required'); this.probe = probe; }
  async enforce(pid, budget = {}) {
    const sample = await this.probe(Number(pid));
    if (!sample?.available) return freeze({ schema: 'forge.process-tree-budget.v1', status: 'unavailable', platform: sample?.platform ?? process.platform, unavailable: [...(sample?.unavailable ?? [])], probeReceiptSha256: sample?.receiptSha256 ?? null });
    const metrics = ['cpuMs', 'rssMb', 'processes', 'fileDescriptors']; const violations = [];
    for (const metric of metrics) {
      const limit = Number(budget[metric]); const actual = Number(sample[metric]);
      if (Number.isFinite(limit) && Number.isFinite(actual) && actual > limit) violations.push(freeze({ metric, actual, limit }));
    }
    return receipt({ schema: 'forge.process-tree-budget.v1', status: violations.length ? 'denied' : 'pass', platform: sample.platform ?? process.platform, sample: Object.fromEntries(metrics.map((metric) => [metric, sample[metric] ?? null])), violations, probeReceiptSha256: sample.receiptSha256 });
  }
}

export class ResourceLeaseManager {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.resources = new Map(); }
  register(id, { lastUsedAtMs = this.clock(), ttlMs = 60_000, unload } = {}) { if (typeof unload !== 'function') throw new TypeError('resource unload is required'); this.resources.set(String(id), { lastUsedAtMs: Number(lastUsedAtMs), ttlMs: Math.max(1, Number(ttlMs)), unload }); return this; }
  touch(id, atMs = this.clock()) { const item = this.resources.get(String(id)); if (item) item.lastUsedAtMs = Number(atMs); }
  async sweep({ pressure = 'normal', nowMs = this.clock() } = {}) { const unloaded = []; for (const [id, item] of this.resources) { if (pressure === 'high' || pressure === 'critical' || nowMs - item.lastUsedAtMs >= item.ttlMs) { await item.unload({ reason: pressure === 'normal' ? 'idle-ttl' : 'resource-pressure' }); this.resources.delete(id); unloaded.push(id); } } return receipt({ schema: 'forge.resource-lease-sweep.v1', pressure, unloaded }); }
}

export class BrowserContextPool {
  constructor({ factory, reset } = {}) { if (typeof factory !== 'function' || typeof reset !== 'function') throw new TypeError('browser factory and reset are required'); this.factory = factory; this.reset = reset; this.byMission = new Map(); }
  async acquire({ missionId, journeyId } = {}) {
    const mission = required(missionId, 'missionId'); const journey = required(journeyId, 'journeyId'); let context = this.byMission.get(mission); let resetReceiptSha256 = null; let reused = false;
    if (!context) { context = await this.factory({ missionId: mission }); this.byMission.set(mission, context); }
    else { const reset = await this.reset(context, { missionId: mission, journeyId: journey }); if (!reset?.reset || !/^[a-f0-9]{64}$/i.test(String(reset.receiptSha256 ?? ''))) throw new Error('browser context reset receipt is required'); resetReceiptSha256 = reset.receiptSha256; reused = true; }
    return freeze({ schema: 'forge.browser-context-lease.v1', missionId: mission, journeyId: journey, context, reused, resetReceiptSha256 });
  }
}

export class DemandAwareResourceCoordinator {
  async prepare({ predicted = [], embedding } = {}) {
    const heavy = predicted.some((item) => item === 'browser' || item === 'test'); let embeddingUnloaded = false;
    if (heavy && embedding?.loaded && typeof embedding.close === 'function') { await embedding.close(); embeddingUnloaded = true; }
    return receipt({ schema: 'forge.demand-aware-resource-decision.v1', predicted: [...predicted].map(String).sort(), embeddingUnloaded });
  }
}

export class StartupRssBudget {
  constructor({ coldMaxMb, warmMaxMb } = {}) { this.coldMaxMb = Number(coldMaxMb); this.warmMaxMb = Number(warmMaxMb); if (!Number.isFinite(this.coldMaxMb) || !Number.isFinite(this.warmMaxMb)) throw new TypeError('cold and warm RSS budgets are required'); }
  measure({ cold = [], warm = [] } = {}) { const coldPeakMb = Math.max(0, ...cold.map(Number)); const warmPeakMb = Math.max(0, ...warm.map(Number)); const violations = []; if (coldPeakMb > this.coldMaxMb) violations.push('cold'); if (warmPeakMb > this.warmMaxMb) violations.push('warm'); return receipt({ schema: 'forge.startup-rss-budget.v1', status: violations.length ? 'fail' : 'pass', coldPeakMb, warmPeakMb, coldMaxMb: this.coldMaxMb, warmMaxMb: this.warmMaxMb, violations }); }
}

export class ReviewerContextIsolation {
  create({ executor, reviewer } = {}) {
    const executorId = required(executor?.identity, 'executor identity'); const reviewerId = required(reviewer?.identity, 'reviewer identity'); if (executorId === reviewerId) throw new Error('reviewer identity must be independent from executor');
    const executorContextSha256 = sha256(canonical(executor.context ?? [])); const reviewerContextSha256 = sha256(canonical(reviewer.context ?? []));
    return receipt({ schema: 'forge.reviewer-context-isolation.v1', executorIdentity: executorId, reviewerIdentity: reviewerId, executorContextSha256, reviewerContextSha256, sharedContext: false });
  }
}

export class GraphOwnershipResolver {
  resolve({ agents = [], graphEdges = [] } = {}) {
    const symbolOwners = new Map(); for (const agent of agents) for (const symbol of agent.symbols ?? []) symbolOwners.set(String(symbol), String(agent.id));
    const ownership = {};
    for (const item of graphEdges) { if (!item.citation?.sourceHash) throw new TypeError('ownership graph citation is required'); const owner = symbolOwners.get(String(item.symbol)); if (owner) ownership[String(item.path)] = owner; }
    return receipt({ schema: 'forge.graph-derived-ownership.v1', ownership });
  }
}

export class CoalitionCommunicationGovernor {
  constructor({ maxBytes = 4096 } = {}) { this.maxBytes = Math.max(1, Number(maxBytes)); }
  selectAndBroadcast(candidates = []) {
    if (!candidates.length) return receipt({ schema: 'forge.coalition-communication.v1', broadcasts: [], bytes: 0, maxBytes: this.maxBytes });
    const winner = [...candidates].sort((a, b) => Number(b.utility) - Number(a.utility) || String(a.coalitionId).localeCompare(String(b.coalitionId)))[0];
    const message = String(winner.message ?? ''); const bytes = Buffer.byteLength(message, 'utf8'); if (bytes > this.maxBytes) throw new Error('coalition communication budget exceeded');
    return receipt({ schema: 'forge.coalition-communication.v1', broadcasts: [{ coalitionId: String(winner.coalitionId), workspaceId: String(winner.workspaceId), message }], bytes, maxBytes: this.maxBytes });
  }
}

export class CoordinationMetrics {
  static calculate({ decisions = [], coordinationMs = 0, totalMs = 0, conflicts = 0, assignments = 0, productiveParallelMs = 0, totalParallelMs = 0 } = {}) {
    const routingRegret = decisions.length ? decisions.reduce((sum, item) => sum + Math.max(0, Number(item.optimal) - Number(item.chosen)), 0) / decisions.length : 0;
    const round = (value) => Number(value.toFixed(12));
    return freeze({ schema: 'forge.coordination-metrics.v1', routingRegret: round(routingRegret), coordinationOverhead: totalMs > 0 ? round(Number(coordinationMs) / Number(totalMs)) : 0, conflictRate: assignments > 0 ? round(Number(conflicts) / Number(assignments)) : 0, usefulParallelism: totalParallelMs > 0 ? round(Number(productiveParallelMs) / Number(totalParallelMs)) : 0 });
  }
}
