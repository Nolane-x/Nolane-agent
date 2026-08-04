import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function text(value, label, max = 4_000) {
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
function positive(value, fallback, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new TypeError(`${label} must be positive`);
  return number;
}
function stringList(value, label, { min = 0, max = 32 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new TypeError(`${label} must contain ${min} to ${max} items`);
  return value.map((item, index) => text(item, `${label}[${index}]`, 1_000));
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function normalize(items) {
  const active = items.filter((item) => item.status === 'active');
  const total = active.reduce((sum, item) => sum + item.probability, 0);
  const uniform = active.length ? 1 / active.length : 0;
  return items.map((item) => item.status === 'active'
    ? { ...item, probability: total > 0 ? item.probability / total : uniform }
    : { ...item, probability: 0 });
}
function ordered(items) {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.probability - a.probability || a.id.localeCompare(b.id);
  });
}

export class HypothesisPopulation {
  constructor({ maxActive = 3, maxEvidencePerHypothesis = 128 } = {}) {
    this.maxActive = Math.max(1, Math.min(3, Math.floor(Number(maxActive) || 3)));
    this.maxEvidencePerHypothesis = Math.max(1, Math.min(1_000, Math.floor(Number(maxEvidencePerHypothesis) || 128)));
    this.tasks = new Map();
  }

  start(taskId, hypotheses) {
    const id = text(taskId, 'taskId', 256);
    if (!Array.isArray(hypotheses) || hypotheses.length === 0) throw new TypeError('hypotheses must contain at least one item');
    const ids = new Set();
    const normalized = hypotheses.map((item, index) => {
      const hypothesisId = text(item?.id, `hypotheses[${index}].id`, 256);
      if (ids.has(hypothesisId)) throw new TypeError(`duplicate hypothesis id: ${hypothesisId}`);
      ids.add(hypothesisId);
      return {
        id: hypothesisId,
        claim: text(item?.claim, `hypotheses[${index}].claim`),
        probability: probability(item?.probability, `hypotheses[${index}].probability`),
        predictions: stringList(item?.predictions, `hypotheses[${index}].predictions`, { min: 1, max: 32 }),
        falsificationCondition: text(item?.falsificationCondition, `hypotheses[${index}].falsificationCondition`),
        testCost: positive(item?.testCost, 1, `hypotheses[${index}].testCost`),
        supportEvidence: [],
        counterEvidence: [],
        age: 0,
        status: 'active',
        falsifiedBy: null,
      };
    }).sort((a, b) => b.probability - a.probability || a.id.localeCompare(b.id)).slice(0, this.maxActive);
    this.tasks.set(id, normalize(normalized));
    return this.snapshot(id);
  }

  observe(taskId, evidence = {}) {
    const id = text(taskId, 'taskId', 256);
    const items = this.#get(id);
    const evidenceId = text(evidence.evidenceId, 'evidenceId', 256);
    const supports = new Set(Array.isArray(evidence.supports) ? evidence.supports.map((item) => text(item, 'supports[]', 256)) : []);
    const contradicts = new Set(Array.isArray(evidence.contradicts) ? evidence.contradicts.map((item) => text(item, 'contradicts[]', 256)) : []);
    const known = new Set(items.map((item) => item.id));
    for (const hypothesisId of [...supports, ...contradicts]) if (!known.has(hypothesisId)) throw new RangeError(`unknown hypothesis: ${hypothesisId}`);
    const supportLikelihood = positive(evidence.supportLikelihood, 2, 'supportLikelihood');
    const contradictionLikelihood = positive(evidence.contradictionLikelihood, 0.5, 'contradictionLikelihood');
    const next = items.map((item) => {
      if (item.status !== 'active') return item;
      let multiplier = 1;
      if (supports.has(item.id)) multiplier *= supportLikelihood;
      if (contradicts.has(item.id)) multiplier *= contradictionLikelihood;
      return {
        ...item,
        probability: item.probability * multiplier,
        supportEvidence: supports.has(item.id) ? [...item.supportEvidence, evidenceId].slice(-this.maxEvidencePerHypothesis) : item.supportEvidence,
        counterEvidence: contradicts.has(item.id) ? [...item.counterEvidence, evidenceId].slice(-this.maxEvidencePerHypothesis) : item.counterEvidence,
        age: item.age + 1,
      };
    });
    this.tasks.set(id, normalize(next));
    return this.snapshot(id);
  }

  falsify(taskId, hypothesisId, evidenceId) {
    const id = text(taskId, 'taskId', 256);
    const target = text(hypothesisId, 'hypothesisId', 256);
    const evidence = text(evidenceId, 'evidenceId', 256);
    const items = this.#get(id);
    if (!items.some((item) => item.id === target)) throw new RangeError(`unknown hypothesis: ${target}`);
    this.tasks.set(id, normalize(items.map((item) => item.id === target
      ? { ...item, status: 'falsified', probability: 0, falsifiedBy: evidence, counterEvidence: [...item.counterEvidence, evidence].slice(-this.maxEvidencePerHypothesis) }
      : item)));
    return this.snapshot(id);
  }

  dominant(taskId) {
    return this.snapshot(taskId).hypotheses.find((item) => item.status === 'active') ?? null;
  }

  snapshot(taskId) {
    const id = text(taskId, 'taskId', 256);
    const items = ordered(this.#get(id));
    return signed({
      schema: 'forge.hypothesis-population.v1',
      taskId: id,
      hypotheses: items.map((item) => ({ ...item, predictions: [...item.predictions], supportEvidence: [...item.supportEvidence], counterEvidence: [...item.counterEvidence] })),
      activeCount: items.filter((item) => item.status === 'active').length,
      dominantHypothesisId: items.find((item) => item.status === 'active')?.id ?? null,
    });
  }

  #get(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new RangeError(`unknown task: ${taskId}`);
    return task;
  }
}
