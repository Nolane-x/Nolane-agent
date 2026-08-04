const ALIAS = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function alias(value, label) { const text = String(value ?? '').trim(); if (!ALIAS.test(text)) throw new TypeError(`${label} alias is invalid`); return text; }
function metadata(service, account, present = true) { return Object.freeze({ service, account, present }); }

export class MemoryCredentialBackend {
  #values = new Map();
  #key(service, account) { return `${service}\0${account}`; }
  async set({ service, account, secret }) { this.#values.set(this.#key(service, account), String(secret)); return metadata(service, account); }
  async resolve({ service, account }) { return this.#values.get(this.#key(service, account)) ?? null; }
  async list({ service = null } = {}) {
    const values = [];
    for (const key of this.#values.keys()) { const [itemService, account] = key.split('\0'); if (!service || itemService === service) values.push(metadata(itemService, account)); }
    return values.sort((a, b) => a.service.localeCompare(b.service) || a.account.localeCompare(b.account));
  }
  async delete({ service, account }) { return this.#values.delete(this.#key(service, account)); }
  async close() { this.#values.clear(); }
}

export class CredentialVault {
  constructor({ backend, maxSecretBytes = 16 * 1024 } = {}) {
    if (!backend) throw new TypeError('credential backend is required');
    this.backend = backend;
    this.maxSecretBytes = Math.max(1, Number(maxSecretBytes) || 16 * 1024);
  }
  #ref({ service, account } = {}) { return { service: alias(service, 'service'), account: alias(account, 'account') }; }
  async set(input = {}) {
    const ref = this.#ref(input); const secret = String(input.secret ?? '');
    if (!secret) throw new TypeError('secret is required');
    const bytes = Buffer.byteLength(secret); if (bytes > this.maxSecretBytes) throw new TypeError(`secret exceeds ${this.maxSecretBytes} byte limit`);
    await this.backend.set({ ...ref, secret }); return metadata(ref.service, ref.account);
  }
  async resolve(input = {}) { const ref = this.#ref(input); return this.backend.resolve(ref); }
  async list({ service = null } = {}) { const filter = service == null || service === '' ? null : alias(service, 'service'); return (await this.backend.list({ service: filter })).map((item) => metadata(alias(item.service, 'service'), alias(item.account, 'account'), item.present !== false)); }
  async delete(input = {}) { return Boolean(await this.backend.delete(this.#ref(input))); }
  async close() { await this.backend.close?.(); }
}
