import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
export class GatewayAdapterRuntime {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.adapters = new Map(); this.deliveries = new Map(); }
  register({ id, platform, capabilities = [], adapter } = {}) {
    const key = String(id ?? '').trim(); if (!key || !adapter || typeof adapter.send !== 'function' || typeof adapter.normalizeInbound !== 'function') throw new TypeError('gateway id and adapter are required');
    if (this.adapters.has(key)) throw new Error(`gateway adapter already registered: ${key}`);
    this.adapters.set(key, { id: key, platform: String(platform ?? key), capabilities: [...new Set(capabilities.map(String))].sort(), adapter, state: 'registered' });
  }
  async start(id) { const row = this.#get(id); await row.adapter.start?.(); row.state = 'running'; return this.status(id); }
  async stop(id) { const row = this.#get(id); await row.adapter.stop?.(); row.state = 'stopped'; return this.status(id); }
  normalizeInbound(id, raw) { const row = this.#get(id); const value = row.adapter.normalizeInbound(raw); const base = { schema: 'nolane.gateway.inbound.v1', platform: row.platform, adapterId: row.id, eventId: String(value.eventId ?? ''), principalId: String(value.principalId ?? ''), channel: String(value.channel ?? ''), text: String(value.text ?? ''), attachments: Array.isArray(value.attachments) ? value.attachments : [], timestampMs: this.clock() }; return freeze({ ...base, attachments: freeze([...base.attachments]), receiptSha256: sha256(JSON.stringify(base)) }); }
  async deliver(id, message) {
    const row = this.#get(id); if (row.state !== 'running') throw new Error(`gateway adapter is not running: ${row.id}`);
    const eventId = String(message?.eventId ?? ''); if (!eventId) throw new TypeError('eventId is required');
    const key = `${row.id}:${eventId}`; if (this.deliveries.has(key)) return freeze({ ...this.deliveries.get(key), replayed: true });
    const result = await row.adapter.send({ eventId, channel: String(message.channel ?? ''), text: String(message.text ?? ''), attachments: Array.isArray(message.attachments) ? message.attachments : [] });
    const base = { schema: 'nolane.gateway.delivery.v1', adapterId: row.id, platform: row.platform, eventId, externalId: String(result?.externalId ?? ''), deliveredAtMs: this.clock(), replayed: false };
    const receipt = freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) }); this.deliveries.set(key, receipt); return receipt;
  }
  status(id) { const row = this.#get(id); return freeze({ id: row.id, platform: row.platform, state: row.state, capabilities: freeze([...row.capabilities]) }); }
  snapshot() { return freeze({ schema: 'nolane.gateway-adapter-snapshot.v1', adapters: freeze([...this.adapters.values()].map((row) => this.status(row.id)).sort((a, b) => a.id.localeCompare(b.id))), deliveries: this.deliveries.size }); }
  #get(id) { const row = this.adapters.get(String(id)); if (!row) throw new Error(`unknown gateway adapter: ${id}`); return row; }
}
