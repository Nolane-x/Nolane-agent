import { createHash, randomBytes } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const requiredText = (value, name) => {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
};

export class GatewayApiSurface {
  #gateways;
  #clock;
  #deliveryHandler;
  #runtimeSnapshot;
  #maxAttachmentBytes;
  #maxEvents;
  #pairings = new Map();
  #authorizations = new Map();
  #events = [];
  #eventsById = new Map();
  #idempotency = new Map();
  #deliveries = new Map();
  #headSha256 = '0'.repeat(64);
  #media = null;
  #audio = null;

  constructor({ gateways, clock = () => Date.now(), deliveryHandler = async () => ({ delivered: true }), runtimeSnapshot = () => ({}), maxAttachmentBytes = 10_000_000, maxEvents = 10_000 } = {}) {
    if (!gateways || typeof gateways.status !== 'function') throw new TypeError('gateways registry is required');
    if (typeof clock !== 'function' || typeof deliveryHandler !== 'function' || typeof runtimeSnapshot !== 'function') throw new TypeError('clock, deliveryHandler and runtimeSnapshot functions are required');
    this.#gateways = gateways;
    this.#clock = clock;
    this.#deliveryHandler = deliveryHandler;
    this.#runtimeSnapshot = runtimeSnapshot;
    this.#maxAttachmentBytes = Math.max(1, Number(maxAttachmentBytes) || 10_000_000);
    this.#maxEvents = Math.max(1, Number(maxEvents) || 10_000);
  }

  issuePairing({ gatewayId, expiresInMs = 300_000 } = {}) {
    const id = requiredText(gatewayId, 'gatewayId');
    this.#gateways.status(id);
    const ttl = Number(expiresInMs);
    if (!Number.isFinite(ttl) || ttl < 1 || ttl > 3_600_000) throw new RangeError('expiresInMs must be between 1 and 3600000');
    let code;
    do { code = randomBytes(8).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(8, '0').slice(0, 8); } while (this.#pairings.has(code));
    const issuedAt = this.#clock();
    const record = { gatewayId: id, issuedAt, expiresAt: issuedAt + ttl, used: false };
    this.#pairings.set(code, record);
    return freeze({ schema: 'nolane.native.gateway-pairing.v1', code, gatewayId: id, issuedAt, expiresAt: record.expiresAt });
  }

  acceptPairing({ code, principalId } = {}) {
    const normalizedCode = requiredText(code, 'code').toUpperCase();
    const principal = requiredText(principalId, 'principalId');
    const record = this.#pairings.get(normalizedCode);
    if (!record) throw new Error('Unknown pairing code');
    if (record.used) throw new Error('Pairing code already used');
    if (this.#clock() > record.expiresAt) throw new Error('Pairing code expired');
    record.used = true;
    const key = this.#authorizationKey(record.gatewayId, principal);
    const authorization = freeze({ schema: 'nolane.native.gateway-authorization.v1', gatewayId: record.gatewayId, principalId: principal, authorized: true, pairedAt: this.#clock() });
    this.#authorizations.set(key, authorization);
    return authorization;
  }

  authorization(gatewayId, principalId) {
    const id = requiredText(gatewayId, 'gatewayId');
    const principal = requiredText(principalId, 'principalId');
    return this.#authorizations.get(this.#authorizationKey(id, principal)) ?? freeze({ schema: 'nolane.native.gateway-authorization.v1', gatewayId: id, principalId: principal, authorized: false, pairedAt: null });
  }

  enqueueEvent({ gatewayId, principalId, sessionId, type, text = '', idempotencyKey = null, attachments = [] } = {}) {
    const id = requiredText(gatewayId, 'gatewayId');
    const principal = requiredText(principalId, 'principalId');
    if (!this.authorization(id, principal).authorized) throw new Error(`Principal is not paired or unauthorized for gateway: ${id}`);
    const session = requiredText(sessionId, 'sessionId');
    const eventType = requiredText(type, 'type');
    const keyText = idempotencyKey === null ? null : requiredText(idempotencyKey, 'idempotencyKey');
    const idempotencyLookup = keyText === null ? null : `${id}\u0000${principal}\u0000${keyText}`;
    if (idempotencyLookup && this.#idempotency.has(idempotencyLookup)) return this.#eventsById.get(this.#idempotency.get(idempotencyLookup));
    if (this.#events.length >= this.#maxEvents) throw new Error(`Gateway event limit exceeded: ${this.#maxEvents}`);
    if (!Array.isArray(attachments)) throw new TypeError('attachments must be an array');
    const normalizedAttachments = attachments.map((item, index) => this.#normalizeAttachment(item, index));
    const totalBytes = normalizedAttachments.reduce((sum, item) => sum + item.bytes, 0);
    if (totalBytes > this.#maxAttachmentBytes) throw new Error(`Attachment byte limit exceeded: ${totalBytes} > ${this.#maxAttachmentBytes}`);
    const sequence = this.#events.length + 1;
    const createdAt = this.#clock();
    const core = {
      schema: 'nolane.native.gateway-event.v1', sequence, gatewayId: id, principalId: principal, sessionId: session,
      type: eventType, text: String(text ?? ''), idempotencyKey: keyText, attachments: normalizedAttachments,
      createdAt, previousSha256: this.#headSha256,
    };
    const eventId = `evt_${sha256(canonical(core)).slice(0, 24)}`;
    const receiptSha256 = sha256(canonical({ ...core, eventId }));
    const event = freeze({ ...core, eventId, receiptSha256 });
    this.#events.push(event);
    this.#eventsById.set(eventId, event);
    if (idempotencyLookup) this.#idempotency.set(idempotencyLookup, eventId);
    this.#headSha256 = receiptSha256;
    return event;
  }

  stream({ afterSequence = 0, limit = 100 } = {}) {
    const after = Math.max(0, Number(afterSequence) || 0);
    const bounded = Math.min(500, Math.max(1, Number(limit) || 100));
    return freeze(this.#events.filter((event) => event.sequence > after).slice(0, bounded).map((event) => event));
  }

  async deliver(eventId) {
    const id = requiredText(eventId, 'eventId');
    if (this.#deliveries.has(id)) return this.#deliveries.get(id);
    const event = this.#eventsById.get(id);
    if (!event) throw new Error(`Unknown gateway event: ${id}`);
    const output = await this.#deliveryHandler(freeze({ gatewayId: event.gatewayId, principalId: event.principalId, sessionId: event.sessionId, type: event.type, text: event.text, attachments: event.attachments, eventId: event.eventId }));
    if (!output?.delivered) throw new Error(`Gateway delivery failed: ${id}`);
    const core = { schema: 'nolane.native.gateway-delivery.v1', eventId: id, eventReceiptSha256: event.receiptSha256, externalId: output.externalId === undefined ? null : String(output.externalId), status: 'delivered', deliveredAt: this.#clock() };
    const receipt = freeze({ ...core, receiptSha256: sha256(canonical(core)) });
    this.#deliveries.set(id, receipt);
    return receipt;
  }

  attachMedia({ media = null, audio = null } = {}) {
    if (media !== null && typeof media.execute !== 'function') throw new TypeError('media registry must expose execute');
    if (audio !== null && typeof audio.execute !== 'function') throw new TypeError('audio registry must expose execute');
    this.#media = media;
    this.#audio = audio;
    return this;
  }

  async executeMedia({ kind, capability, input = {}, providerId = null } = {}) {
    const selected = String(kind ?? '');
    const registry = selected === 'media' ? this.#media : selected === 'audio' ? this.#audio : null;
    if (!registry) throw new Error(`Native ${selected || 'media'} provider registry is not configured`);
    const result = await registry.execute({ capability, input, providerId });
    const { bytes: _bytes, ...safe } = result;
    return freeze(structuredClone(safe));
  }

  snapshot() {
    const runtime = structuredClone(this.#runtimeSnapshot() ?? {});
    return freeze({ schema: 'nolane.native.gateway-api-surface.v1', runtime, pairings: [...this.#pairings.values()].filter((item) => !item.used && this.#clock() <= item.expiresAt).length, authorizations: this.#authorizations.size, events: this.#events.length, delivered: this.#deliveries.size, headSha256: this.#headSha256 });
  }

  #authorizationKey(gatewayId, principalId) { return `${gatewayId}\u0000${principalId}`; }

  #normalizeAttachment(item, index) {
    if (!item || typeof item !== 'object') throw new TypeError(`attachment ${index} must be an object`);
    const bytes = Buffer.from(item.bytes ?? []);
    if (bytes.length > this.#maxAttachmentBytes) throw new Error(`Attachment byte limit exceeded: ${bytes.length} > ${this.#maxAttachmentBytes}`);
    const digest = sha256(bytes);
    if (item.sha256 !== undefined && String(item.sha256).toLowerCase() !== digest) throw new Error(`Attachment hash mismatch at index ${index}`);
    return freeze({ name: requiredText(item.name, `attachment ${index} name`), mimeType: requiredText(item.mimeType, `attachment ${index} mimeType`), bytes: bytes.length, sha256: digest });
  }
}
