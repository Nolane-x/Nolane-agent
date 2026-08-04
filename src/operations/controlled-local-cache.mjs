import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SECRET_RE = /(?:\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|password|secret|token)\s*[:=]\s*[^\s]{8,})/i;
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); if (text.length > 256) throw new TypeError(`${label} is too long`); return text; }
function bounded(value, min, max, label) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`); return number; }
function publicEntry(row) {
  const base = {
    schema: 'forge.controlled-cache-entry.v1', projectId: row.project_id, principalId: row.principal_id,
    namespace: row.namespace, key: row.cache_key, bytes: Number(row.bytes), contentSha256: row.content_sha256,
    createdAtMs: Number(row.created_at), accessedAtMs: Number(row.accessed_at), expiresAtMs: Number(row.expires_at),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class ControlledLocalCache {
  constructor({ file, maxBytes = 50_000_000, clockMs = Date.now } = {}) {
    this.file = path.resolve(String(file ?? ''));
    this.maxBytes = bounded(maxBytes, 1, 2_000_000_000, 'maxBytes');
    this.clockMs = clockMs;
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS controlled_cache(
        project_id TEXT NOT NULL, principal_id TEXT NOT NULL, namespace TEXT NOT NULL, cache_key TEXT NOT NULL,
        value BLOB NOT NULL, bytes INTEGER NOT NULL, content_sha256 TEXT NOT NULL,
        created_at INTEGER NOT NULL, accessed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        PRIMARY KEY(project_id,principal_id,namespace,cache_key)
      );
      CREATE INDEX IF NOT EXISTS controlled_cache_lru ON controlled_cache(accessed_at);`);
  }
  close() { this.db.close(); }
  #scope(input) { return { projectId: required(input.projectId, 'projectId'), principalId: required(input.principalId, 'principalId'), namespace: required(input.namespace, 'namespace') }; }
  #deleteExpired(now = this.clockMs()) { this.db.prepare('DELETE FROM controlled_cache WHERE expires_at<=?').run(now); }
  #totalBytes() { return Number(this.db.prepare('SELECT COALESCE(SUM(bytes),0) AS total FROM controlled_cache').get().total); }
  #evictToFit(incomingBytes) {
    this.#deleteExpired();
    while (this.#totalBytes() + incomingBytes > this.maxBytes) {
      const row = this.db.prepare('SELECT project_id,principal_id,namespace,cache_key FROM controlled_cache ORDER BY accessed_at ASC, created_at ASC LIMIT 1').get();
      if (!row) break;
      this.db.prepare('DELETE FROM controlled_cache WHERE project_id=? AND principal_id=? AND namespace=? AND cache_key=?').run(row.project_id,row.principal_id,row.namespace,row.cache_key);
    }
    if (this.#totalBytes() + incomingBytes > this.maxBytes) throw Object.assign(new Error('Cache quota exceeded'), { code: 'CONTROLLED_CACHE_QUOTA_EXCEEDED' });
  }
  put(input = {}) {
    const scope = this.#scope(input); const key = required(input.key, 'key'); const value = Buffer.from(input.value ?? []);
    if (!value.length) throw new TypeError('value is required');
    if (value.length > this.maxBytes) throw Object.assign(new Error('Cache entry exceeds quota'), { code: 'CONTROLLED_CACHE_ENTRY_TOO_LARGE' });
    const asText = value.length <= 1_000_000 ? value.toString('utf8') : '';
    if (SECRET_RE.test(asText) || /secret|password|token|api[_-]?key/i.test(key)) throw Object.assign(new Error('Plaintext secret is not allowed in controlled cache'), { code: 'CONTROLLED_CACHE_SECRET_DENIED' });
    const ttlMs = bounded(input.ttlMs ?? 300_000, 1, 86_400_000, 'ttlMs'); const now = this.clockMs();
    const existing = this.db.prepare('SELECT bytes FROM controlled_cache WHERE project_id=? AND principal_id=? AND namespace=? AND cache_key=?').get(scope.projectId,scope.principalId,scope.namespace,key);
    if (existing) this.db.prepare('DELETE FROM controlled_cache WHERE project_id=? AND principal_id=? AND namespace=? AND cache_key=?').run(scope.projectId,scope.principalId,scope.namespace,key);
    try {
      this.#evictToFit(value.length);
      const contentSha256 = canonicalSha256({ encoding:'base64', value:value.toString('base64') });
      this.db.prepare(`INSERT INTO controlled_cache(project_id,principal_id,namespace,cache_key,value,bytes,content_sha256,created_at,accessed_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .run(scope.projectId,scope.principalId,scope.namespace,key,value,value.length,contentSha256,now,now,now+ttlMs);
      return this.get({ ...scope, key });
    } catch (error) { if (existing) throw error; throw error; }
  }
  get(input = {}) {
    const scope = this.#scope(input); const key = required(input.key, 'key'); const now = this.clockMs(); this.#deleteExpired(now);
    const row = this.db.prepare('SELECT * FROM controlled_cache WHERE project_id=? AND principal_id=? AND namespace=? AND cache_key=?').get(scope.projectId,scope.principalId,scope.namespace,key);
    if (!row) return null;
    this.db.prepare('UPDATE controlled_cache SET accessed_at=? WHERE project_id=? AND principal_id=? AND namespace=? AND cache_key=?').run(now,scope.projectId,scope.principalId,scope.namespace,key);
    const updated = { ...row, accessed_at: now };
    return Object.freeze({ ...publicEntry(updated), value: Buffer.from(row.value) });
  }
  list(input = {}) {
    const scope = this.#scope(input); const limit = bounded(input.limit ?? 100, 1, 500, 'limit'); this.#deleteExpired();
    const rows = this.db.prepare('SELECT * FROM controlled_cache WHERE project_id=? AND principal_id=? AND namespace=? ORDER BY accessed_at DESC LIMIT ?').all(scope.projectId,scope.principalId,scope.namespace,limit);
    const entries = Object.freeze(rows.map(publicEntry)); const base = { schema:'forge.controlled-cache-list.v1', ...scope, entries };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  purge(input = {}) {
    const scope = this.#scope(input);
    const result = this.db.prepare('DELETE FROM controlled_cache WHERE project_id=? AND principal_id=? AND namespace=?').run(scope.projectId,scope.principalId,scope.namespace);
    const base = { schema:'forge.controlled-cache-purge.v1', ...scope, deleted:Number(result.changes), purgedAtMs:this.clockMs() };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
