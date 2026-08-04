export class LazyDependencyResolver {
  constructor() { this.loaders = new Map(); this.cache = new Map(); }
  register(id, loader) { const key = String(id); if (!key || typeof loader !== 'function') throw new TypeError('Dependency requires id and loader'); if (this.loaders.has(key)) throw new Error(`Duplicate dependency: ${key}`); this.loaders.set(key, loader); return this; }
  async resolve(id) { const key = String(id); if (this.cache.has(key)) return this.cache.get(key); const loader = this.loaders.get(key); if (!loader) throw Object.assign(new Error(`Dependency not registered: ${key}`), { code: 'DEPENDENCY_NOT_REGISTERED' }); const promise = Promise.resolve().then(loader); this.cache.set(key, promise); try { return await promise; } catch (error) { this.cache.delete(key); throw error; } }
  clear(id = null) { if (id == null) this.cache.clear(); else this.cache.delete(String(id)); }
  snapshot() { return Object.freeze({ schema: 'nolane.lazy-dependencies.v1', registered: [...this.loaders.keys()].sort(), loaded: [...this.cache.keys()].sort() }); }
}
