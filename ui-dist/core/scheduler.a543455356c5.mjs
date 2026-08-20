export function createScheduler({ frame = (callback) => requestAnimationFrame(callback), idle = (callback) => (globalThis.requestIdleCallback ? requestIdleCallback(callback) : setTimeout(callback, 0)) } = {}) {
  const queues = { frame: new Map(), idle: new Map(), background: new Map() };
  const scheduled = new Set(); let destroyed = false;
  const assertAlive = () => { if (destroyed) throw new Error('Scheduler is destroyed'); };
  async function drain(priority) {
    scheduled.delete(priority);
    const tasks = [...queues[priority].values()]; queues[priority].clear();
    for (const callback of tasks) await callback();
  }
  function schedule(priority) {
    if (scheduled.has(priority)) return;
    scheduled.add(priority);
    const trigger = priority === 'frame' ? frame : idle;
    trigger(() => { if (!destroyed) void drain(priority); });
  }
  return Object.freeze({
    enqueue(key, callback, { priority = 'frame' } = {}) {
      assertAlive();
      if (typeof callback !== 'function') throw new TypeError('Scheduler callback must be a function');
      if (!queues[priority]) throw new Error(`Unknown scheduler priority: ${priority}`);
      queues[priority].set(String(key), callback); schedule(priority);
    },
    async flush() { assertAlive(); await drain('frame'); await drain('idle'); await drain('background'); },
    cancel(key) { for (const queue of Object.values(queues)) queue.delete(String(key)); },
    destroy() { for (const queue of Object.values(queues)) queue.clear(); scheduled.clear(); destroyed = true; },
    snapshot() { return Object.freeze({ destroyed, pending: Object.freeze(Object.fromEntries(Object.entries(queues).map(([key, queue]) => [key, queue.size]))) }); },
  });
}
