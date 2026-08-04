const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

export class ExecutionBackendRegistry {
  #backends = new Map();

  register(definition) {
    if (!definition?.id || !definition.kind || typeof definition.execute !== 'function') throw new TypeError('Execution backend requires id, kind and execute');
    const id = String(definition.id);
    if (this.#backends.has(id)) throw new Error(`Duplicate execution backend: ${id}`);
    this.#backends.set(id, Object.freeze({
      id,
      kind: String(definition.kind),
      capabilities: Object.freeze([...(definition.capabilities ?? [])].map(String).sort()),
      available: typeof definition.available === 'function' ? definition.available : () => definition.available !== false,
      execute: definition.execute,
      cleanup: typeof definition.cleanup === 'function' ? definition.cleanup : null,
    }));
    return this;
  }

  get(id) { return this.#backends.get(String(id)) ?? null; }

  require(id) {
    const backend = this.get(id);
    if (!backend) throw Object.assign(new Error(`Execution backend not registered: ${id}`), { code: 'BACKEND_NOT_FOUND' });
    if (!backend.available()) throw Object.assign(new Error(`Execution backend unavailable: ${id}`), { code: 'BACKEND_UNAVAILABLE', backendId: String(id) });
    return backend;
  }

  describe() {
    return freeze([...this.#backends.values()].map((backend) => ({ id: backend.id, kind: backend.kind, capabilities: [...backend.capabilities], available: Boolean(backend.available()) })).sort((a, b) => a.id.localeCompare(b.id)));
  }
}
