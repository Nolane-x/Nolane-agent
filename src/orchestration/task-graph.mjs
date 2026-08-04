function normalizePath(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, ''); }
function ownsOverlap(left, right) {
  const a = normalizePath(left).replace(/\/\*\*$/, '');
  const b = normalizePath(right).replace(/\/\*\*$/, '');
  if (!a || !b || a === '**' || b === '**') return true;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export class TaskGraph {
  constructor(tasks, order) { this.tasks = new Map(tasks.map((task) => [task.id, Object.freeze({ ...task, dependencies: [...(task.dependencies ?? [])], allowedPaths: [...(task.allowedPaths ?? [])] })])); this.order = Object.freeze(order); }

  static validate(tasks) {
    if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array');
    const map = new Map();
    for (const task of tasks) {
      const id = String(task?.id ?? '').trim();
      if (!id) throw new TypeError('task id is required');
      if (map.has(id)) throw new Error(`Duplicate task: ${id}`);
      map.set(id, { ...task, id, dependencies: [...(task.dependencies ?? [])], allowedPaths: [...(task.allowedPaths ?? [])] });
    }
    for (const task of map.values()) for (const dependency of task.dependencies) if (!map.has(dependency)) throw new Error(`Unknown dependency ${dependency} for ${task.id}`);
    const independent = [...map.values()].filter((task) => task.dependencies.length === 0);
    for (let i = 0; i < independent.length; i += 1) for (let j = i + 1; j < independent.length; j += 1) {
      for (const left of independent[i].allowedPaths) for (const right of independent[j].allowedPaths) {
        if (ownsOverlap(left, right)) throw new Error(`Path ownership conflict between ${independent[i].id} and ${independent[j].id}: ${left} <> ${right}`);
      }
    }
    const indegree = new Map([...map].map(([id, task]) => [id, task.dependencies.length]));
    const dependents = new Map([...map.keys()].map((id) => [id, []]));
    for (const task of map.values()) for (const dependency of task.dependencies) dependents.get(dependency).push(task.id);
    const queue = [...indegree].filter(([, count]) => count === 0).map(([id]) => id).sort();
    const order = [];
    while (queue.length) {
      const id = queue.shift(); order.push(id);
      for (const child of dependents.get(id).sort()) {
        indegree.set(child, indegree.get(child) - 1);
        if (indegree.get(child) === 0) { queue.push(child); queue.sort(); }
      }
    }
    if (order.length !== map.size) throw new Error('Task dependency cycle detected');
    return new TaskGraph([...map.values()], order);
  }

  ready(statuses = new Map()) {
    return this.order.filter((id) => {
      const state = statuses.get(id);
      if (state && !['todo', 'ready'].includes(state)) return false;
      return this.tasks.get(id).dependencies.every((dependency) => statuses.get(dependency) === 'done');
    });
  }
}

function assertLease(task, { workerId, fencingToken }, nowMs) {
  if (task.fencingToken !== fencingToken) throw new Error(`Stale fencing token: expected ${task.fencingToken}, got ${fencingToken}`);
  if (task.leaseOwner !== workerId) throw new Error(`Lease belongs to ${task.leaseOwner ?? 'nobody'}`);
  if (Date.parse(task.leaseExpiresAt ?? 0) <= nowMs) throw new Error('Lease expired');
}

export class TaskScheduler {
  constructor({ store, now = () => Date.now() } = {}) { if (!store) throw new TypeError('store is required'); this.store = store; this.now = now; }

  claim({ missionId, workerId, leaseMs = 60_000 }) {
    const nowMs = this.now();
    const tasks = this.store.listTasks({ missionId });
    const statuses = new Map(tasks.map((task) => [task.id, task.status]));
    const candidates = tasks.filter((task) => {
      const expired = task.status === 'working' && Date.parse(task.leaseExpiresAt ?? 0) <= nowMs;
      const available = ['todo', 'ready'].includes(task.status) || expired;
      return available && task.dependencies.every((dependency) => statuses.get(dependency) === 'done');
    }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const task = candidates[0];
    if (!task) return null;
    const updated = this.store.updateTask(task.id, {
      status: 'working',
      leaseOwner: String(workerId),
      leaseExpiresAt: new Date(nowMs + Number(leaseMs)).toISOString(),
      fencingToken: task.fencingToken + 1,
    });
    return Object.freeze({ task: updated, workerId: updated.leaseOwner, leaseExpiresAt: updated.leaseExpiresAt, fencingToken: updated.fencingToken });
  }

  heartbeat({ taskId, workerId, fencingToken, leaseMs = 60_000 }) {
    const task = this.store.getTask(taskId); assertLease(task, { workerId, fencingToken }, this.now());
    return this.store.updateTask(taskId, { leaseExpiresAt: new Date(this.now() + Number(leaseMs)).toISOString() });
  }

  complete({ taskId, workerId, fencingToken }) {
    const task = this.store.getTask(taskId); assertLease(task, { workerId, fencingToken }, this.now());
    return this.store.updateTask(taskId, { status: 'done', leaseOwner: null, leaseExpiresAt: null });
  }

  fail({ taskId, workerId, fencingToken, reason }) {
    const task = this.store.getTask(taskId); assertLease(task, { workerId, fencingToken }, this.now());
    return this.store.updateTask(taskId, { status: 'failed', leaseOwner: null, leaseExpiresAt: null, metadata: { ...task.metadata, failureReason: String(reason ?? '') } });
  }
}
