import { createEvent } from '../protocol/events.mjs';

const STATUSES = new Set(['active', 'paused', 'completed', 'failed', 'cancelled']);
const IMPACTS = new Set(['low', 'medium', 'high', 'critical']);
const OPERATORS = new Set(['<', '<=', '=', '>=', '>']);

function text(value, label, max = 20_000) {
  const out = String(value ?? '').trim();
  if (!out) throw new TypeError(`${label} is required`);
  if (out.length > max) throw new TypeError(`${label} is too long`);
  return out;
}

function criteria(items) {
  if (!Array.isArray(items)) throw new TypeError('successCriteria must be an array');
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`successCriteria[${index}] is invalid`);
    const operator = String(item.operator ?? '=').trim();
    if (!OPERATORS.has(operator)) throw new TypeError(`successCriteria[${index}].operator is invalid`);
    return Object.freeze({ id: text(item.id ?? `criterion-${index + 1}`, 'criterion id', 128), metric: text(item.metric, 'criterion metric', 256), operator, target: structuredClone(item.target), description: item.description == null ? null : text(item.description, 'criterion description', 2_000) });
  });
}

function assumptions(items) {
  if (!Array.isArray(items)) throw new TypeError('assumptions must be an array');
  const ids = new Set();
  return items.map((item, index) => {
    const id = text(item?.id ?? `assumption-${index + 1}`, 'assumption id', 128);
    if (ids.has(id)) throw new TypeError(`duplicate assumption id: ${id}`);
    ids.add(id);
    return Object.freeze({ id, statement: text(item?.statement, 'assumption statement', 4_000), status: String(item?.status ?? 'active'), source: item?.source == null ? null : structuredClone(item.source) });
  });
}

function boundedBudget(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('budget must be an object');
  const out = {};
  for (const key of ['maxTotalTokens', 'maxCostUsd', 'maxElapsedMs', 'maxMissions', 'maxReplans']) {
    if (value[key] == null) continue;
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number < 0) throw new TypeError(`budget.${key} is invalid`);
    out[key] = number;
  }
  return Object.freeze(out);
}

function normalizedSchedule(value = { kind: 'manual' }) {
  const kind = String(value?.kind ?? 'manual');
  if (!['manual', 'interval', 'repository-change'].includes(kind)) throw new TypeError('schedule.kind is invalid');
  if (kind === 'interval') {
    const everyMs = Number(value.everyMs);
    if (!Number.isFinite(everyMs) || everyMs < 60_000) throw new TypeError('schedule.everyMs must be at least 60000');
    return Object.freeze({ kind, everyMs });
  }
  return Object.freeze({ kind, ...(kind === 'repository-change' ? { debounceMs: Math.max(5_000, Number(value.debounceMs) || 30_000) } : {}) });
}

export class GoalService {
  constructor({ store } = {}) {
    if (!store?.createGoal || !store?.appendEvent) throw new TypeError('GoalService store is required');
    this.store = store;
  }

  create({ projectId, title, objective, status = 'active', successCriteria = [], budget = {}, schedule = { kind: 'manual' }, assumptions: assumptionItems = [], metadata = {} } = {}) {
    if (!STATUSES.has(String(status))) throw new TypeError('goal status is invalid');
    const goal = this.store.createGoal({ projectId: text(projectId, 'projectId', 256), title: text(title, 'goal title', 500), objective: text(objective, 'goal objective'), status, successCriteria: criteria(successCriteria), budget: boundedBudget(budget), schedule: normalizedSchedule(schedule), assumptions: assumptions(assumptionItems), metadata });
    this.store.appendEvent(createEvent('goal.created', { title: goal.title, status: goal.status, revision: goal.revision }, { projectId: goal.projectId, goalId: goal.id }));
    return goal;
  }

  get(goalId) { return this.store.getGoal(String(goalId)); }
  list(options = {}) { return this.store.listGoals(options); }

  update(goalId, changes = {}) {
    const current = this.get(goalId);
    if (!current) throw new Error(`Unknown goal: ${goalId}`);
    const nextChanges = { ...structuredClone(changes), revision: current.revision + 1 };
    if (changes.status !== undefined && !STATUSES.has(String(changes.status))) throw new TypeError('goal status is invalid');
    if (changes.successCriteria !== undefined) nextChanges.successCriteria = criteria(changes.successCriteria);
    if (changes.budget !== undefined) nextChanges.budget = boundedBudget(changes.budget);
    if (changes.schedule !== undefined) nextChanges.schedule = normalizedSchedule(changes.schedule);
    if (changes.assumptions !== undefined) nextChanges.assumptions = assumptions(changes.assumptions);
    const updated = this.store.updateGoal(goalId, nextChanges);
    this.store.appendEvent(createEvent('goal.updated', { status: updated.status, revision: updated.revision }, { projectId: updated.projectId, goalId: updated.id }));
    return updated;
  }

  attachMission(goalId, missionId, { relation = 'supporting' } = {}) {
    const link = this.store.attachGoalMission(goalId, missionId, { relation });
    const goal = this.get(goalId);
    const updated = this.store.updateGoal(goalId, { activeMissionId: missionId, updatedAt: new Date().toISOString() });
    this.store.appendEvent(createEvent('goal.mission.attached', { missionId, relation }, { projectId: goal.projectId, goalId, missionId }));
    return Object.freeze({ ...updated, missionLink: link });
  }

  recordFact(goalId, { claim, confidence = 0.5, impact = 'medium', status = 'observed', source = {}, receiptSha256 = null, invalidatesAssumptionIds = [] } = {}) {
    if (!IMPACTS.has(String(impact))) throw new TypeError('goal fact impact is invalid');
    if (receiptSha256 != null && !/^[a-f0-9]{64}$/i.test(String(receiptSha256))) throw new TypeError('receiptSha256 must be a SHA-256 hex value');
    const goal = this.get(goalId);
    if (!goal) throw new Error(`Unknown goal: ${goalId}`);
    const fact = this.store.createGoalFact({ goalId, claim: text(claim, 'goal fact claim'), confidence, impact, status, source, receiptSha256, invalidatesAssumptionIds });
    this.store.appendEvent(createEvent('goal.fact.recorded', { factId: fact.id, impact: fact.impact, confidence: fact.confidence, invalidatesAssumptionIds: fact.invalidatesAssumptionIds }, { projectId: goal.projectId, goalId }));
    return fact;
  }

  listFacts(goalId) { return this.store.listGoalFacts(goalId); }

  recordPlanRevision(goalId, { summary, plan, reason = '' } = {}) {
    const goal = this.get(goalId);
    if (!goal) throw new Error(`Unknown goal: ${goalId}`);
    const revision = this.store.listGoalPlanRevisions(goalId).length + 1;
    const record = this.store.createGoalPlanRevision({ goalId, revision, summary: text(summary, 'plan revision summary', 2_000), reason: String(reason ?? ''), plan: structuredClone(plan ?? {}) });
    this.store.appendEvent(createEvent('goal.plan.revision-recorded', { planRevision: record.revision, summary: record.summary }, { projectId: goal.projectId, goalId }));
    return record;
  }

  listPlanRevisions(goalId) { return this.store.listGoalPlanRevisions(goalId); }
}
