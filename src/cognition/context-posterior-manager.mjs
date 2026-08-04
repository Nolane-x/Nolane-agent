import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function text(value, label, max = 2_000) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}

function probability(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a finite non-negative number`);
  return number;
}

function likelihood(value, fallback, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new TypeError(`${label} must be a finite positive number`);
  return number;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

function normalize(items) {
  const total = items.reduce((sum, item) => sum + item.probability, 0);
  if (!(total > 0)) {
    const uniform = 1 / items.length;
    return items.map((item) => ({ ...item, probability: uniform }));
  }
  return items.map((item) => ({ ...item, probability: item.probability / total }));
}

function normalizedEntropy(items) {
  if (items.length <= 1) return 0;
  const entropy = -items.reduce((sum, item) => item.probability > 0 ? sum + item.probability * Math.log(item.probability) : sum, 0);
  return entropy / Math.log(items.length);
}

export class ContextPosteriorManager {
  constructor({ maxContexts = 5, maxNormalizedEntropyForMemory = 0.45, minLeaderProbabilityForMemory = 0.7, maxEvidencePerContext = 128 } = {}) {
    this.maxContexts = Math.max(1, Math.min(16, Math.floor(Number(maxContexts) || 5)));
    this.maxNormalizedEntropyForMemory = Math.max(0, Math.min(1, Number(maxNormalizedEntropyForMemory) || 0));
    this.minLeaderProbabilityForMemory = Math.max(0, Math.min(1, Number(minLeaderProbabilityForMemory) || 0));
    this.maxEvidencePerContext = Math.max(1, Math.min(1_000, Math.floor(Number(maxEvidencePerContext) || 128)));
    this.tasks = new Map();
  }

  start(taskId, contexts) {
    const id = text(taskId, 'taskId', 256);
    if (!Array.isArray(contexts) || contexts.length === 0) throw new TypeError('contexts must contain at least one item');
    const ids = new Set();
    const selected = contexts.map((item, index) => {
      const contextId = text(item?.id, `contexts[${index}].id`, 256);
      if (ids.has(contextId)) throw new TypeError(`duplicate context id: ${contextId}`);
      ids.add(contextId);
      return {
        id: contextId,
        claim: String(item?.claim ?? '').trim().slice(0, 2_000),
        probability: probability(item?.probability, `contexts[${index}].probability`),
        supportEvidence: [],
        counterEvidence: [],
        age: 0,
      };
    }).sort((a, b) => b.probability - a.probability || a.id.localeCompare(b.id)).slice(0, this.maxContexts);
    this.tasks.set(id, normalize(selected));
    return this.snapshot(id);
  }

  observe(taskId, evidence = {}) {
    const id = text(taskId, 'taskId', 256);
    const contexts = this.#get(id);
    const evidenceId = text(evidence.evidenceId, 'evidenceId', 256);
    const supports = new Set(Array.isArray(evidence.supports) ? evidence.supports.map((item) => text(item, 'supports[]', 256)) : []);
    const contradicts = new Set(Array.isArray(evidence.contradicts) ? evidence.contradicts.map((item) => text(item, 'contradicts[]', 256)) : []);
    const known = new Set(contexts.map((item) => item.id));
    for (const contextId of [...supports, ...contradicts]) {
      if (!known.has(contextId)) throw new RangeError(`unknown context: ${contextId}`);
    }
    const supportLikelihood = likelihood(evidence.supportLikelihood, 2, 'supportLikelihood');
    const contradictionLikelihood = likelihood(evidence.contradictionLikelihood, 0.5, 'contradictionLikelihood');
    const next = contexts.map((item) => {
      let multiplier = 1;
      if (supports.has(item.id)) multiplier *= supportLikelihood;
      if (contradicts.has(item.id)) multiplier *= contradictionLikelihood;
      const supportEvidence = supports.has(item.id) ? [...item.supportEvidence, evidenceId].slice(-this.maxEvidencePerContext) : item.supportEvidence;
      const counterEvidence = contradicts.has(item.id) ? [...item.counterEvidence, evidenceId].slice(-this.maxEvidencePerContext) : item.counterEvidence;
      return { ...item, probability: item.probability * multiplier, supportEvidence, counterEvidence, age: item.age + 1 };
    });
    this.tasks.set(id, normalize(next));
    return this.snapshot(id);
  }

  canWriteDurableMemory(taskId) {
    const snapshot = this.snapshot(taskId);
    const leader = snapshot.contexts[0];
    const reasons = [];
    if (snapshot.normalizedEntropy > this.maxNormalizedEntropyForMemory) reasons.push('posterior-dispersed');
    if ((leader?.probability ?? 0) < this.minLeaderProbabilityForMemory) reasons.push('leader-probability-low');
    return signed({
      schema: 'forge.context-memory-write-gate.v1',
      taskId: snapshot.taskId,
      allowed: reasons.length === 0,
      reasons,
      leaderContextId: leader?.id ?? null,
      leaderProbability: leader?.probability ?? 0,
      normalizedEntropy: snapshot.normalizedEntropy,
    });
  }

  snapshot(taskId) {
    const id = text(taskId, 'taskId', 256);
    const contexts = [...this.#get(id)].sort((a, b) => b.probability - a.probability || a.id.localeCompare(b.id));
    return signed({
      schema: 'forge.context-posterior.v1',
      taskId: id,
      contexts: contexts.map((item) => ({ ...item, supportEvidence: [...item.supportEvidence], counterEvidence: [...item.counterEvidence] })),
      normalizedEntropy: normalizedEntropy(contexts),
      concentrated: normalizedEntropy(contexts) <= this.maxNormalizedEntropyForMemory && (contexts[0]?.probability ?? 0) >= this.minLeaderProbabilityForMemory,
    });
  }

  #get(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new RangeError(`unknown task: ${taskId}`);
    return task;
  }
}
