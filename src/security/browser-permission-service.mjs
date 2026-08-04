const READ_ACTIONS = Object.freeze(['open', 'goto', 'snapshot', 'find', 'tabs', 'screenshot', 'close', 'status']);
const WRITE_ACTIONS = Object.freeze(['click', 'fill', 'type', 'press']);
const ALL = new Set([...READ_ACTIONS, ...WRITE_ACTIONS]);

function uniqueActions(value, { writeOnly = false } = {}) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(',');
  const out = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  for (const action of out) {
    if (!ALL.has(action) || (writeOnly && !WRITE_ACTIONS.includes(action))) throw new TypeError(`Unsupported browser write action: ${action}`);
  }
  return out;
}

export class BrowserPermissionService {
  constructor({ store, goalService } = {}) {
    if (!store?.getMission || !store?.listTasks || !goalService?.get || !goalService?.update) throw new TypeError('BrowserPermissionService dependencies are required');
    this.store = store;
    this.goals = goalService;
  }

  inspect({ goalId } = {}) {
    const id = String(goalId ?? '').trim();
    if (!id) throw Object.assign(new TypeError('goalId is required'), { statusCode: 400, code: 'GOAL_ID_REQUIRED' });
    const goal = this.goals.get(id);
    if (!goal) throw Object.assign(new Error(`Unknown goal: ${id}`), { statusCode: 404, code: 'GOAL_NOT_FOUND' });
    const allowedActions = uniqueActions(goal.metadata?.browserAllowedActions ?? READ_ACTIONS);
    return Object.freeze({
      goalId: goal.id,
      projectId: goal.projectId,
      readActions: READ_ACTIONS,
      writeActions: Object.freeze(allowedActions.filter((action) => WRITE_ACTIONS.includes(action))),
      allowedActions: Object.freeze(allowedActions),
      availableWriteActions: WRITE_ACTIONS,
    });
  }

  grant({ goalId, actions } = {}) { return this.#change(goalId, uniqueActions(actions, { writeOnly: true }), 'grant'); }
  revoke({ goalId, actions } = {}) { return this.#change(goalId, uniqueActions(actions, { writeOnly: true }), 'revoke'); }

  #change(goalId, actions, operation) {
    const id = String(goalId ?? '').trim();
    if (!id) throw Object.assign(new TypeError('goalId is required'), { statusCode: 400, code: 'GOAL_ID_REQUIRED' });
    const goal = this.goals.get(id);
    if (!goal) throw Object.assign(new Error(`Unknown goal: ${id}`), { statusCode: 404, code: 'GOAL_NOT_FOUND' });
    const current = uniqueActions(goal.metadata?.browserAllowedActions ?? READ_ACTIONS);
    const next = operation === 'grant'
      ? [...new Set([...current, ...actions])]
      : current.filter((action) => !actions.includes(action));
    const updated = this.goals.update(goal.id, { metadata: { ...(goal.metadata ?? {}), browserAllowedActions: next } });
    const missionId = updated.activeMissionId;
    if (missionId) {
      const mission = this.store.getMission(missionId);
      if (mission) this.store.updateMission(missionId, { metadata: { ...(mission.metadata ?? {}), browserAllowedActions: next } });
      for (const task of this.store.listTasks({ missionId })) {
        if (['done', 'cancelled'].includes(task.status)) continue;
        this.store.updateTask(task.id, { metadata: { ...(task.metadata ?? {}), browserAllowedActions: next } });
      }
    }
    return this.inspect({ goalId: goal.id });
  }
}

export const BROWSER_READ_ACTIONS = READ_ACTIONS;
export const BROWSER_WRITE_ACTIONS = WRITE_ACTIONS;
