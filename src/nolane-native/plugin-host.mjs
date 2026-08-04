import crypto from 'node:crypto';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const DANGEROUS_HOOK = /(?:rm\s+-rf|curl\s|wget\s|powershell|cmd\.exe|child_process|shell:execute)/i;
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());

export class NolanePluginHost {
  constructor({ allowedCapabilities = [], clock = () => Date.now() } = {}) {
    this.allowed = new Set(allowedCapabilities); this.plugins = new Map(); this.clock = clock; this.log = [];
  }
  install(definition) { return this.#install(definition, { type: 'install', signed: false }); }
  installSigned({ manifest, signatureBase64, publicKeyPem, adapter } = {}) {
    if (manifest?.schema !== 'nolane.agent.plugin.v2' || !signatureBase64 || !publicKeyPem) throw new Error('signed plugin manifest, signature and public key are required');
    const valid = crypto.verify(null, Buffer.from(canonical(manifest)), publicKeyPem, Buffer.from(String(signatureBase64), 'base64'));
    if (!valid) throw new Error('plugin manifest signature verification failed');
    return this.#install({ ...manifest, adapter }, { type: 'install-signed', signed: true, signerSha256: sha256(String(publicKeyPem)) });
  }
  #install(definition, metadata) {
    if (!definition?.id || !definition?.kind || !Array.isArray(definition.capabilities)) throw new Error('plugin id, kind and capabilities are required');
    if (this.plugins.has(definition.id)) throw new Error(`plugin already installed: ${definition.id}`);
    const unauthorized = definition.capabilities.filter((capability) => !this.allowed.has(capability));
    const dangerousHooks = (definition.hooks ?? []).filter((hook) => DANGEROUS_HOOK.test(JSON.stringify(hook)));
    const status = unauthorized.length || dangerousHooks.length ? 'quarantined' : 'installed';
    const manifest = { schema: metadata.signed ? 'nolane.agent.plugin.v2' : 'nolane.agent.plugin.v1', id: definition.id, kind: definition.kind, capabilities: [...definition.capabilities].sort(), hooks: definition.hooks ?? [], ...(definition.version ? { version: definition.version } : {}) };
    const record = { definition, status, active: false, signed: metadata.signed, signerSha256: metadata.signerSha256 ?? null, manifestSha256: sha256(canonical(manifest)), quarantineReasons: [...unauthorized.map((item) => `capability:${item}`), ...dangerousHooks.map(() => 'dangerous-hook')] };
    this.plugins.set(definition.id, record);
    this.#append(metadata.type, definition.id, { manifestSha256: record.manifestSha256, status, signed: metadata.signed, signerSha256: record.signerSha256 });
    return this.view(definition.id);
  }
  activate(id) { const item = this.#require(id); if (item.status === 'quarantined') throw new Error(`plugin is quarantined: ${id}`); if (item.status === 'disabled') throw new Error(`plugin is disabled: ${id}`); item.active = true; item.status = 'active'; this.#append('activate', id, {}); return this.view(id); }
  disable(id, { reason = 'operator-disabled' } = {}) { const item = this.#require(id); item.active = false; item.status = 'disabled'; item.disabledReason = String(reason); this.#append('disable', id, { reason: item.disabledReason }); return this.view(id); }
  async send(id, message) {
    const item = this.#require(id);
    if (!item.active || item.definition.kind !== 'messaging' || typeof item.definition.adapter?.send !== 'function') throw new Error(`messaging plugin is not active: ${id}`);
    if (!item.definition.capabilities.includes('message:send')) throw new Error('messaging plugin lacks message:send capability');
    if (!message || typeof message.channel !== 'string' || typeof message.text !== 'string') throw new Error('typed message requires channel and text');
    return item.definition.adapter.send(Object.freeze({ channel: message.channel, text: message.text, metadata: Object.freeze({ ...(message.metadata ?? {}) }) }));
  }
  view(id) { const item = this.#require(id); return Object.freeze({ id, kind: item.definition.kind, capabilities: Object.freeze([...item.definition.capabilities]), status: item.status, active: item.active, signed: item.signed, signerSha256: item.signerSha256, manifestSha256: item.manifestSha256, quarantineReasons: Object.freeze([...item.quarantineReasons]), disabledReason: item.disabledReason ?? null }); }
  snapshot() { return Object.freeze({ plugins: this.plugins.size, active: [...this.plugins.values()].filter((item) => item.active).length, quarantined: [...this.plugins.values()].filter((item) => item.status === 'quarantined').length, disabled: [...this.plugins.values()].filter((item) => item.status === 'disabled').length }); }
  transparencyLog() {
    const base = { schema: 'nolane.agent.plugin-transparency-log.v1', events: this.log.map((entry) => structuredClone(entry)), headSha256: this.log.at(-1)?.sha256 ?? null };
    return Object.freeze({ ...base, events: Object.freeze(base.events.map(Object.freeze)), receiptSha256: sha256(canonical(base)) });
  }
  #append(type, pluginId, payload) {
    const event = { sequence: this.log.length + 1, type, pluginId: String(pluginId), at: this.clock(), payload, previousSha256: this.log.at(-1)?.sha256 ?? null };
    event.sha256 = sha256(canonical(event)); this.log.push(Object.freeze(event)); return event;
  }
  #require(id) { const item = this.plugins.get(id); if (!item) throw new Error(`unknown plugin: ${id}`); return item; }
}
