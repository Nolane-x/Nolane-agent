export class HostedExecutionBackend {
  constructor({ id, provider } = {}) {
    if (!id || typeof provider?.execute !== 'function') throw new TypeError('Hosted backend requires id and provider.execute');
    this.id = String(id); this.kind = 'hosted'; this.provider = provider;
    this.capabilities = Object.freeze(['cancel', 'hosted', 'non-pty', 'teardown']);
    this.closed = new Set();
  }
  available() { return Boolean(this.provider.available?.() ?? true); }
  async execute(input = {}) {
    if (!this.available()) throw Object.assign(new Error(`Execution backend unavailable: ${this.id}`), { code: 'BACKEND_UNAVAILABLE', backendId: this.id });
    return Object.freeze({ ...(await this.provider.execute({ ...input, backendId: this.id })), mode: 'non-pty' });
  }
  async teardown(input = {}) {
    const key = String(input.remoteId ?? input.jobId ?? 'default');
    if (this.closed.has(key)) return false;
    this.closed.add(key);
    await this.provider.teardown?.(input);
    return true;
  }
}
