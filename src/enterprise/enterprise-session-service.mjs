import { createHash, randomBytes } from 'node:crypto';

function required(value, name) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${name} is required`); return text; }
function hashToken(token) { return createHash('sha256').update(required(token, 'session token')).digest('hex'); }
function list(value, max = 1_000) { if (value == null) return []; if (!Array.isArray(value) || value.length > max) throw new TypeError('session claims must be bounded arrays'); return [...new Set(value.map((item) => required(item, 'session claim')).slice(0, max))]; }
function publicSession(record) { return Object.freeze({ subject: record.subject, organizationId: record.organizationId, email: record.email, groups: Object.freeze([...record.groups]), roles: Object.freeze([...record.roles]), createdAt: record.createdAt, expiresAt: record.expiresAt }); }

export class EnterpriseSessionService {
  constructor({ storage = null, clock = () => Date.now(), ttlMs = 8 * 60 * 60_000 } = {}) {
    this.storage = storage; this.clock = clock; this.ttlMs = Math.max(60_000, Math.min(7 * 24 * 60 * 60_000, Number(ttlMs) || 8 * 60 * 60_000));
    this.sessions = new Map((storage?.loadAll?.() ?? []).map((record) => [record.tokenHash, Object.freeze({ ...record, groups: Object.freeze([...record.groups]), roles: Object.freeze([...record.roles]) })]));
  }
  issue(input = {}) {
    const token = randomBytes(48).toString('base64url'); const tokenHash = hashToken(token); const createdAt = this.clock();
    const record = Object.freeze({ tokenHash, subject: required(input.subject, 'subject'), organizationId: required(input.organizationId, 'organizationId'), email: input.email ? String(input.email).slice(0, 320) : null, groups: Object.freeze(list(input.groups)), roles: Object.freeze(list(input.roles)), createdAt, expiresAt: createdAt + this.ttlMs, revokedAt: null });
    this.sessions.set(tokenHash, record); this.storage?.save?.(record);
    return Object.freeze({ token, session: publicSession(record) });
  }
  authenticate(token) {
    if (!token) return null;
    const record = this.sessions.get(hashToken(token));
    if (!record || record.revokedAt != null || record.expiresAt <= this.clock()) return null;
    return publicSession(record);
  }
  revoke(token) {
    if (!token) return false; const tokenHash = hashToken(token); const record = this.sessions.get(tokenHash); if (!record || record.revokedAt != null) return false;
    const updated = Object.freeze({ ...record, revokedAt: this.clock() }); this.sessions.set(tokenHash, updated); this.storage?.save?.(updated); return true;
  }
  sweep() {
    const now = this.clock(); let removed = 0;
    for (const [key, record] of this.sessions) if (record.expiresAt <= now || record.revokedAt != null) { this.sessions.delete(key); removed += 1; }
    this.storage?.deleteExpired?.(now); return removed;
  }
}
