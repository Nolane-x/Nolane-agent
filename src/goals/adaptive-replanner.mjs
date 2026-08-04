import { createEvent } from '../protocol/events.mjs';

const MUTABLE_STATUSES = new Set(['todo', 'ready', 'failed', 'cancelled', 'blocked', 'changes-requested']);
const HIGH_IMPACT = new Set(['high', 'critical']);

function required(value, label, max = 20_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} is too long`);
  return text;
}

function stringArray(value, label, max = 256) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return [...new Set(value.map((item) => required(item, label, 1_000)))].slice(0, max);
}

function normalizePatch(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('plan patch must be an object');
  const addTasks = Array.isArray(patch.addTasks) ? patch.addTasks.map((task, index) => ({
    key: required(task?.key ?? `task-${index + 1}`, 'added task key', 128),
    title: required(task?.title, 'added task title', 500),
    objective: required(task?.objective, 'added task objective'),
    role: task?.role == null ? 'builder' : required(task.role, 'added task role', 128),
    dependencies: stringArray(task?.dependencies, 'added task dependencies'),
    allowedPaths: stringArray(task?.allowedPaths ?? ['**'], 'added task allowedPaths'),
    deniedPaths: stringArray(task?.deniedPaths, 'added task deniedPaths'),
    metadata: task?.metadata && typeof task.metadata === 'object' && !Array.isArray(task.metadata) ? structuredClone(task.metadata) : {},
  })) : [];
  const keys = new Set();
  for (const task of addTasks) {
    if (keys.has(task.key)) throw new TypeError(`duplicate added task key: ${task.key}`);
    keys.add(task.key);
  }
  const updateTasks = Array.isArray(patch.updateTasks) ? patch.updateTasks.map((change) => {
    const out = { taskId: required(change?.taskId, 'updated task id', 256) };
    for (const key of ['title', 'objective', 'role']) if (change?.[key] !== undefined) out[key] = required(change[key], `updated task ${key}`, key === 'objective' ? 20_000 : 500);
    for (const key of ['dependencies', 'allowedPaths', 'deniedPaths']) if (change?.[key] !== undefined) out[key] = stringArray(change[key], `updated task ${key}`);
    if (change?.metadata !== undefined) out.metadata = structuredClone(change.metadata);
    return out;
  }) : [];
  return Object.freeze({
    addTasks: Object.freeze(addTasks),
    updateTasks: Object.freeze(updateTasks),
    cancelTaskIds: Object.freeze(stringArray(patch.cancelTaskIds, 'cancelTaskIds')),
  });
}

export class AdaptiveReplanner {
  constructor({ store, goalService } = {}) {
    if (!store?.getGoalPlanPatch || !store?.transaction) throw new TypeError('AdaptiveReplanner store is required');
    if (!goalService?.recordFact || !goalService?.update) throw new TypeError('AdaptiveReplanner goalService is required');
    this.store = store;
    this.goals = goalService;
  }

  observe({ goalId, finding, proposedPatch = null, reason = null, idempotencyKey = null } = {}) {
    const fact = this.goals.recordFact(goalId, finding);
    const shouldReplan = HIGH_IMPACT.has(fact.impact) || fact.invalidatesAssumptionIds.length > 0;
    const patch = shouldReplan && proposedPatch
      ? this.propose({ goalId, patch: proposedPatch, reason: reason ?? `Finding ${fact.id} requires a plan update.`, idempotencyKey: idempotencyKey ?? `finding:${fact.id}` })
      : null;
    return Object.freeze({ fact, shouldReplan, patch });
  }

  propose({ goalId, reason, patch, idempotencyKey = null } = {}) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Unknown goal: ${goalId}`);
    const existing = this.store.findGoalPlanPatchByKey(goalId, idempotencyKey);
    if (existing) return existing;
    const record = this.store.createGoalPlanPatch({ goalId, baseRevision: goal.revision, reason: required(reason, 'plan patch reason', 4_000), patch: normalizePatch(patch), idempotencyKey });
    this.store.appendEvent(createEvent('goal.plan.patch-proposed', { patchId: record.id, baseRevision: record.baseRevision, reason: record.reason, addCount: record.patch.addTasks.length, updateCount: record.patch.updateTasks.length, cancelCount: record.patch.cancelTaskIds.length }, { projectId: goal.projectId, goalId }));
    return record;
  }

  apply(patchId) {
    const record = this.store.getGoalPlanPatch(patchId);
    if (!record) throw new Error(`Unknown goal plan patch: ${patchId}`);
    if (record.status === 'applied') return Object.freeze({ patch: record, goal: this.goals.get(record.goalId), changedTasks: [], addedTasks: [] });
    if (record.status !== 'proposed') throw new Error(`Plan patch is not applicable from status ${record.status}`);
    const goal = this.goals.get(record.goalId);
    if (goal.revision !== record.baseRevision) throw new Error(`Plan patch is stale: expected goal revision ${record.baseRevision}, received ${goal.revision}`);
    const missionId = goal.activeMissionId;
    if (!missionId) throw new Error('Goal has no active mission for plan patch application');

    const touched = [...record.patch.updateTasks.map((item) => item.taskId), ...record.patch.cancelTaskIds];
    const uniqueTouched = [...new Set(touched)];
    for (const taskId of uniqueTouched) {
      const task = this.store.getTask(taskId);
      if (!task || task.missionId !== missionId) throw new Error(`Plan patch references an unknown task in the active mission: ${taskId}`);
      if (!MUTABLE_STATUSES.has(task.status)) throw new Error(`Task ${taskId} is immutable after it has started or completed`);
    }

    return this.store.transaction(() => {
      const changedTasks = [];
      for (const change of record.patch.updateTasks) {
        const current = this.store.getTask(change.taskId);
        const next = { ...change };
        delete next.taskId;
        if (next.metadata !== undefined) next.metadata = { ...current.metadata, ...next.metadata, planPatchId: record.id };
        else next.metadata = { ...current.metadata, planPatchId: record.id };
        changedTasks.push(this.store.updateTask(change.taskId, next));
      }
      for (const taskId of record.patch.cancelTaskIds) {
        const current = this.store.getTask(taskId);
        changedTasks.push(this.store.updateTask(taskId, { status: 'cancelled', metadata: { ...current.metadata, cancelledByPlanPatchId: record.id } }));
      }
      const addedTasks = record.patch.addTasks.map((task) => this.store.createTask({ projectId: goal.projectId, missionId, title: task.title, objective: task.objective, status: 'todo', role: task.role, dependencies: task.dependencies, allowedPaths: task.allowedPaths, deniedPaths: task.deniedPaths, metadata: { ...task.metadata, planPatchId: record.id, planTaskKey: task.key } }));
      const updatedGoal = this.goals.update(goal.id, { metadata: { ...goal.metadata, lastPlanPatchId: record.id } });
      this.goals.recordPlanRevision(goal.id, { summary: record.reason, reason: `Applied patch ${record.id}`, plan: { patchId: record.id, ...record.patch } });
      const appliedPatch = this.store.updateGoalPlanPatch(record.id, { status: 'applied', appliedAt: new Date().toISOString() });
      this.store.appendEvent(createEvent('goal.plan.patch-applied', { patchId: record.id, goalRevision: updatedGoal.revision, changedTaskIds: changedTasks.map((task) => task.id), addedTaskIds: addedTasks.map((task) => task.id) }, { projectId: goal.projectId, goalId: goal.id, missionId }));
      return Object.freeze({ patch: appliedPatch, goal: updatedGoal, changedTasks: Object.freeze(changedTasks), addedTasks: Object.freeze(addedTasks) });
    });
  }
}
