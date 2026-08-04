import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

function sha256(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function publicRecord(record, extra = {}) {
  const { resumeTokenSha256: _secret, ...safe } = record;
  return Object.freeze({ ...safe, ...extra });
}

export class InterruptManager {
  constructor({ store, clock = Date.now } = {}) {
    if (!store?.createInterrupt || !store?.updateInterrupt) throw new TypeError('interrupt-capable store is required');
    this.store = store; this.clock = clock;
  }

  create({ missionId, taskId = null, kind = 'operator-input', prompt = {}, expiresInMs = 24 * 60 * 60_000, idempotencyKey } = {}) {
    const duration = Number(expiresInMs);
    if (!Number.isFinite(duration) || duration < 1 || duration > 30 * 24 * 60 * 60_000) throw new TypeError('expiresInMs is invalid');
    const resumeToken = randomBytes(32).toString('base64url');
    const createdAt = new Date(this.clock()).toISOString();
    const result = this.store.createInterrupt({ missionId, taskId, kind, prompt, resumeTokenSha256: sha256(resumeToken), idempotencyKey: required(idempotencyKey, 'idempotencyKey'), expiresAt: new Date(this.clock() + duration).toISOString(), createdAt });
    if (!result.created) return publicRecord(result.record, { duplicate: true, resumeToken: null });
    return publicRecord(result.record, { duplicate: false, resumeToken });
  }

  get(interruptId) {
    const record = this.store.getInterrupt(required(interruptId, 'interruptId'), { internal: true });
    return record ? publicRecord(record) : null;
  }

  list(filters = {}) { return this.store.listInterrupts({ ...filters, internal: true }).map((record) => publicRecord(record)); }

  resume({ interruptId, resumeToken, response = {}, idempotencyKey } = {}) {
    const id = required(interruptId, 'interruptId');
    const key = required(idempotencyKey, 'idempotencyKey');
    let current = this.store.getInterrupt(id, { internal: true });
    if (!current) throw new Error(`Unknown interrupt: ${id}`);
    if (current.status === 'resumed') {
      if (current.resumeIdempotencyKey === key) return publicRecord(current, { duplicate: true });
      throw new Error(`Interrupt ${id} was already resumed`);
    }
    if (current.status !== 'pending') throw new Error(`Interrupt ${id} is ${current.status}`);
    if (Date.parse(current.expiresAt) <= this.clock()) {
      current = this.store.updateInterrupt(id, { status: 'expired', updatedAt: new Date(this.clock()).toISOString() });
      throw new Error(`Interrupt ${id} expired`);
    }
    const expected = Buffer.from(current.resumeTokenSha256, 'hex');
    const actual = Buffer.from(sha256(required(resumeToken, 'resumeToken')), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid resume token');
    const resumed = this.store.transaction(() => {
      const latest = this.store.getInterrupt(id, { internal: true });
      if (latest.status !== 'pending') throw new Error(`Interrupt ${id} was already resumed`);
      return this.store.updateInterrupt(id, { status: 'resumed', response, resumeIdempotencyKey: key, updatedAt: new Date(this.clock()).toISOString() });
    });
    return publicRecord(resumed, { duplicate: false });
  }
}
