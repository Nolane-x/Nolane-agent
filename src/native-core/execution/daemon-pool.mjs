export class DaemonPool {
  constructor({ maxSize = 4, factory } = {}) {
    if (typeof factory !== 'function') throw new TypeError('DaemonPool factory is required');
    this.maxSize = Math.max(1, Number(maxSize) || 4); this.factory = factory; this.entries = new Map(); this.closed = false;
  }
  async acquire(key) {
    if (this.closed) throw Object.assign(new Error('Daemon pool is closed'), { code: 'DAEMON_POOL_CLOSED' });
    const id = String(key);
    let entry = this.entries.get(id);
    if (!entry) {
      if (this.entries.size >= this.maxSize) throw Object.assign(new Error('Daemon pool exhausted'), { code: 'DAEMON_POOL_EXHAUSTED' });
      entry = { resource: await this.factory(id), leases: 0, released: false };
      this.entries.set(id, entry);
    }
    entry.leases += 1;
    let released = false;
    return Object.freeze({ resource: entry.resource, release: async () => { if (released) return false; released = true; entry.leases = Math.max(0, entry.leases - 1); return true; } });
  }
  snapshot() { return Object.freeze({ schema: 'nolane.daemon-pool.v1', size: this.entries.size, maxSize: this.maxSize, closed: this.closed }); }
  async close() {
    if (this.closed) return false;
    this.closed = true;
    await Promise.all([...this.entries.values()].map((entry) => entry.resource?.close?.()));
    this.entries.clear();
    return true;
  }
}
