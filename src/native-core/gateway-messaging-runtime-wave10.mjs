import { createHash, randomBytes } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const clone = (value) => structuredClone(value);
const attachment = (input, maxBytes) => {
  const bytes = Buffer.isBuffer(input?.bytes) ? input.bytes : Buffer.from(input?.bytes ?? '');
  if (bytes.length > maxBytes) throw Object.assign(new Error('Attachment exceeds size budget'), { code: 'ATTACHMENT_TOO_LARGE' });
  return freeze({ name: String(input?.name ?? 'attachment'), mimeType: String(input?.mimeType ?? 'application/octet-stream'), bytes: bytes.length, sha256: sha256(bytes) });
};

export class GatewayRelayNormalizer {
  constructor({ maxAttachmentBytes = 20 * 1024 * 1024 } = {}) { this.maxAttachmentBytes = Math.max(1, Number(maxAttachmentBytes) || 1); }
  normalize(input = {}) {
    const eventId = String(input.eventId ?? ''); const principalId = String(input.principalId ?? ''); const channel = String(input.channel ?? '');
    if (!eventId || !principalId || !channel) throw Object.assign(new Error('eventId, principalId and channel are required'), { code: 'INVALID_GATEWAY_EVENT' });
    const base = { schema: 'nolane.gateway.relay-normalized.v1', eventId, principalId, channel, text: String(input.text ?? ''), attachments: (input.attachments ?? []).map((item) => attachment(item, this.maxAttachmentBytes)) };
    return freeze({ ...base, attachments: freeze(base.attachments), receiptSha256: sha256(JSON.stringify(base)) });
  }
}

export class GatewayMessagingRuntimeWave10 {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.adapters = new Map(); this.deliveries = new Map(); }
  register({ id, platform, adapter } = {}) {
    const key = String(id ?? '');
    if (!key || !adapter?.manifest || typeof adapter.normalizeInbound !== 'function' || typeof adapter.send !== 'function') throw new TypeError('adapter manifest, normalizeInbound and send are required');
    if (this.adapters.has(key)) throw new Error(`gateway adapter already registered: ${key}`);
    const manifest = { platform: String(platform ?? adapter.manifest.platform ?? key), permissions: [...new Set((adapter.manifest.permissions ?? []).map(String))].sort(), maxAttachmentBytes: Math.max(1, Number(adapter.manifest.maxAttachmentBytes) || 20 * 1024 * 1024) };
    this.adapters.set(key, { id: key, platform: manifest.platform, adapter, manifest, state: 'registered', failures: 0 });
    return this.status(key);
  }
  async start(id) { const row = this.#get(id); const probe = await row.adapter.probe?.(); if (probe && probe.ready === false) throw Object.assign(new Error('Gateway unavailable'), { code: 'GATEWAY_UNAVAILABLE' }); await row.adapter.start?.(); row.state = 'running'; return this.status(id); }
  async stop(id) { const row = this.#get(id); await row.adapter.stop?.(); row.state = 'stopped'; return this.status(id); }
  normalizeInbound(id, raw) { const row = this.#get(id); const value = row.adapter.normalizeInbound(raw); const normalized = new GatewayRelayNormalizer({ maxAttachmentBytes: row.manifest.maxAttachmentBytes }).normalize(value); return freeze({ ...normalized, adapterId: row.id, platform: row.platform }); }
  async deliver(id, message) {
    const row = this.#get(id); if (row.state !== 'running') throw Object.assign(new Error('Gateway adapter is not running'), { code: 'GATEWAY_NOT_RUNNING' });
    const eventId = String(message?.eventId ?? ''); if (!eventId) throw new TypeError('eventId is required');
    const key = `${row.id}:${eventId}`; const cached = this.deliveries.get(key); if (cached) return freeze({ ...cached, replayed: true });
    const result = await row.adapter.send({ eventId, channel: String(message.channel ?? ''), text: String(message.text ?? ''), attachments: (message.attachments ?? []).map((item) => attachment(item, row.manifest.maxAttachmentBytes)) });
    const base = { schema: 'nolane.gateway.delivery-wave10.v1', adapterId: row.id, platform: row.platform, eventId, externalId: String(result?.externalId ?? ''), deliveredAtMs: Number(this.clock()), replayed: false };
    const receipt = freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) }); this.deliveries.set(key, receipt); return receipt;
  }
  status(id) { const row = this.#get(id); return freeze({ id: row.id, platform: row.platform, state: row.state, permissions: freeze([...row.manifest.permissions]), maxAttachmentBytes: row.manifest.maxAttachmentBytes }); }
  snapshot() { return freeze({ schema: 'nolane.gateway-messaging-runtime-wave10.v1', adapters: freeze([...this.adapters.values()].map((row) => this.status(row.id)).sort((a, b) => a.id.localeCompare(b.id))), deliveries: this.deliveries.size }); }
  #get(id) { const row = this.adapters.get(String(id)); if (!row) throw new Error(`unknown gateway adapter: ${id}`); return row; }
}

export class GatewayAdapterTckWave10 {
  async verify({ id, adapter } = {}) {
    const runtime = new GatewayMessagingRuntimeWave10();
    const checks = { permission: false, lifecycle: false, duplicateDelivery: false, redaction: false };
    checks.permission = Array.isArray(adapter?.manifest?.permissions) && adapter.manifest.permissions.includes('message:send') && adapter.manifest.permissions.includes('message:receive');
    runtime.register({ id, platform: adapter?.manifest?.platform, adapter }); await runtime.start(id); checks.lifecycle = runtime.status(id).state === 'running';
    const first = await runtime.deliver(id, { eventId: 'tck-event', channel: 'tck', text: 'hello' }); const replay = await runtime.deliver(id, { eventId: 'tck-event', channel: 'tck', text: 'hello' }); checks.duplicateDelivery = !first.replayed && replay.replayed;
    checks.redaction = !JSON.stringify(runtime.snapshot()).match(/vault:\/\/|token|secret/i); await runtime.stop(id);
    return freeze({ schema: 'nolane.gateway-adapter-tck-wave10.v1', id: String(id), status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks: freeze(checks), receiptSha256: sha256(JSON.stringify({ id, checks })) });
  }
}

export class GatewayCommandManifest {
  constructor() { this.commands = new Map(); }
  register({ id, permission, handler } = {}) { const key = String(id ?? ''); if (!key || !permission || typeof handler !== 'function') throw new TypeError('command id, permission and handler are required'); if (this.commands.has(key)) throw new Error(`command already registered: ${key}`); this.commands.set(key, { id: key, permission: String(permission), handler }); return this.describe(key); }
  authorize({ commandId, permissions = [] } = {}) { const row = this.commands.get(String(commandId)); if (!row) throw Object.assign(new Error('Unknown command'), { code: 'COMMAND_NOT_FOUND' }); if (!permissions.map(String).includes(row.permission)) throw Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' }); return freeze({ commandId: row.id, allowed: true, permission: row.permission }); }
  execute(input) { const authorization = this.authorize(input); return this.commands.get(authorization.commandId).handler(input.params ?? {}); }
  describe(id) { const row = this.commands.get(String(id)); return freeze({ id: row.id, permission: row.permission }); }
  snapshot() { return freeze({ schema: 'nolane.gateway-command-manifest.v1', commands: freeze([...this.commands.values()].map(({ id, permission }) => freeze({ id, permission })).sort((a,b)=>a.id.localeCompare(b.id))) }); }
}

export class GatewayPairingEnrollment {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.codes = new Map(); }
  issue({ platform, principalId, ttlMs = 300_000 } = {}) { const code = randomBytes(12).toString('base64url'); const row = { code, platform: String(platform), principalId: String(principalId), expiresAt: Number(this.clock()) + Math.max(1, Number(ttlMs) || 1), used: false }; this.codes.set(code, row); return freeze({ code, platform: row.platform, principalId: row.principalId, expiresAt: row.expiresAt }); }
  accept({ code, platform, principalId } = {}) { const row = this.codes.get(String(code)); if (!row) throw Object.assign(new Error('Pairing code not found'), { code: 'PAIRING_NOT_FOUND' }); if (row.used) throw Object.assign(new Error('Pairing code replayed'), { code: 'PAIRING_REPLAY' }); if (Number(this.clock()) > row.expiresAt) throw Object.assign(new Error('Pairing code expired'), { code: 'PAIRING_EXPIRED' }); if (row.platform !== String(platform) || row.principalId !== String(principalId)) throw Object.assign(new Error('Pairing identity mismatch'), { code: 'PAIRING_MISMATCH' }); row.used = true; return freeze({ enrolled: true, platform: row.platform, principalId: row.principalId, enrollmentId: sha256(`${row.code}:${row.platform}:${row.principalId}`) }); }
  snapshot() { return freeze({ schema: 'nolane.gateway-pairing-enrollment.v1', issued: this.codes.size, active: [...this.codes.values()].filter((row) => !row.used && row.expiresAt >= Number(this.clock())).length }); }
}

export class GatewayRemoteLifecycle {
  constructor({ connect, disconnect } = {}) { if (typeof connect !== 'function' || typeof disconnect !== 'function') throw new TypeError('connect and disconnect are required'); this.connect = connect; this.disconnect = disconnect; this.state = 'stopped'; this.session = null; this.attempts = 0; }
  async start({ maxAttempts = 3 } = {}) { this.state = 'connecting'; let last; for (let attempt = 1; attempt <= Math.max(1, Number(maxAttempts)||1); attempt += 1) { this.attempts += 1; try { this.session = await this.connect({ attempt }); this.state = 'running'; return this.snapshot(); } catch (error) { last = error; if (!error?.retryable || attempt >= maxAttempts) { this.state = 'failed'; throw error; } } } throw last; }
  async stop() { if (this.state === 'running') await this.disconnect(this.session); this.session = null; this.state = 'stopped'; return this.snapshot(); }
  snapshot() { return freeze({ schema: 'nolane.gateway-remote-lifecycle.v1', state: this.state, connected: this.state === 'running', attempts: this.attempts, sessionId: this.session?.sessionId ?? null }); }
}

export class GatewayHostSupervisor {
  constructor({ maxRssBytes = 512 * 1024 * 1024 } = {}) { this.maxRssBytes = Math.max(1, Number(maxRssBytes)||1); this.hosts = new Map(); }
  register({ id, stop } = {}) { if (!id || typeof stop !== 'function') throw new TypeError('host id and stop are required'); this.hosts.set(String(id), { id: String(id), stop, state: 'running', rssBytes: 0, reason: null }); return this.status(id); }
  sample(id, { rssBytes = 0 } = {}) { const row = this.#get(id); row.rssBytes = Math.max(0, Number(rssBytes)||0); if (row.rssBytes > this.maxRssBytes) row.state = 'draining'; return this.status(id); }
  async drain(id, reason = 'drain') { const row = this.#get(id); row.state = 'draining'; row.reason = String(reason); await row.stop({ reason: row.reason }); row.state = 'stopped'; return this.status(id); }
  status(id) { const row = this.#get(id); return freeze({ id: row.id, state: row.state, rssBytes: row.rssBytes, reason: row.reason }); }
  snapshot() { return freeze({ schema: 'nolane.gateway-host-supervisor.v1', hosts: freeze([...this.hosts.values()].map((row)=>this.status(row.id))) }); }
  #get(id) { const row = this.hosts.get(String(id)); if (!row) throw new Error(`unknown host: ${id}`); return row; }
}

export class GatewayTuiProjection {
  project({ adapters = [], queueDepth = 0, lastError = null } = {}) { return freeze({ schema: 'nolane.gateway-tui-projection.v1', adapters: freeze(adapters.map((entry) => freeze({ id: String(entry.id), platform: String(entry.platform ?? entry.id), state: String(entry.state ?? 'unknown') }))), queueDepth: Math.max(0, Number(queueDepth)||0), lastError: lastError ? String(lastError.message ?? lastError) : null }); }
}
