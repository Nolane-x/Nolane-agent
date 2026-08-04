import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const clone = (value) => structuredClone(value);
const composite = (scope, key) => `${scope}\u0000${key}`;

export class CrossSessionMemory {
  #file; #clock; #state = null; #queue = Promise.resolve();
  constructor({ file, clock = Date.now } = {}) {
    if (!file || typeof clock !== 'function') throw new TypeError('memory file and clock are required');
    this.#file = path.resolve(String(file)); this.#clock = clock;
  }
  async init() {
    await mkdir(path.dirname(this.#file), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.#file, 'utf8'));
      if (parsed.schema !== 'nolane.native.cross-session-memory.v1' || !parsed.records || typeof parsed.records !== 'object') throw new Error('Invalid cross-session memory schema');
      this.#state = parsed;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      this.#state = { schema: 'nolane.native.cross-session-memory.v1', records: {}, audit: [] };
      await this.#persist(this.#state);
    }
    return this.snapshot();
  }
  #ready() { if (!this.#state) throw new Error('CrossSessionMemory.init() is required'); }
  async #persist(state) {
    const text = `${JSON.stringify(state, null, 2)}\n`; const temporary = `${this.#file}.tmp-${process.pid}`;
    await writeFile(temporary, text, { mode: 0o600 }); await rename(temporary, this.#file);
  }
  #mutate(fn) {
    const operation = this.#queue.then(async () => { this.#ready(); const next = clone(this.#state); const result = fn(next); await this.#persist(next); this.#state = next; return result; });
    this.#queue = operation.catch(() => {}); return operation;
  }
  async put({ key, value, scope = 'global', provenance = [], ttlMs = null, expectedVersion = undefined } = {}) {
    if (!key || !scope || !Array.isArray(provenance) || provenance.length === 0) throw new TypeError('Memory key, scope and provenance are required');
    if (ttlMs !== null && (!Number.isFinite(Number(ttlMs)) || Number(ttlMs) <= 0)) throw new TypeError('ttlMs must be positive');
    return this.#mutate((next) => {
      const id = composite(String(scope), String(key)); const current = next.records[id] ?? null;
      if (expectedVersion !== undefined && Number(expectedVersion) !== Number(current?.version ?? 0)) throw new Error(`Memory version conflict: expected ${expectedVersion}, actual ${current?.version ?? 0}`);
      const base = { key: String(key), scope: String(scope), value: clone(value), version: Number(current?.version ?? 0) + 1, provenance: [...new Set([...(current?.provenance ?? []), ...provenance.map(String)])].sort(), createdAt: current?.createdAt ?? this.#clock(), updatedAt: this.#clock(), expiresAt: ttlMs === null ? null : this.#clock() + Number(ttlMs), invalidatedAt: null, invalidationReason: null };
      const stored = { ...base, receiptSha256: sha256(JSON.stringify(base)) }; next.records[id] = stored; next.audit.push({ type: 'put', id, version: stored.version, at: this.#clock(), receiptSha256: stored.receiptSha256 }); return Object.freeze(clone(stored));
    });
  }
  async get({ key, scope = 'global' } = {}) {
    this.#ready(); const item = this.#state.records[composite(String(scope), String(key))];
    if (!item || item.invalidatedAt !== null || (item.expiresAt !== null && item.expiresAt <= this.#clock())) return null;
    return Object.freeze(clone(item));
  }
  async search({ scope = null, prefix = '', limit = 100 } = {}) {
    this.#ready(); const output = [];
    for (const item of Object.values(this.#state.records)) {
      if (scope !== null && item.scope !== String(scope)) continue;
      if (!item.key.startsWith(String(prefix))) continue;
      if (item.invalidatedAt !== null || (item.expiresAt !== null && item.expiresAt <= this.#clock())) continue;
      output.push(clone(item)); if (output.length >= Math.max(1, Math.min(1000, Number(limit) || 100))) break;
    }
    return Object.freeze(output.sort((a, b) => a.key.localeCompare(b.key)));
  }
  async invalidate({ key, scope = 'global', reason, provenanceReceipt } = {}) {
    if (!key || !reason || !provenanceReceipt) throw new TypeError('Memory invalidation requires key, reason and provenance receipt');
    return this.#mutate((next) => {
      const id = composite(String(scope), String(key)); const current = next.records[id];
      if (!current) return Object.freeze({ key: String(key), scope: String(scope), invalidated: false });
      current.invalidatedAt = this.#clock(); current.invalidationReason = String(reason); current.invalidationReceipt = String(provenanceReceipt);
      const base = { key: String(key), scope: String(scope), invalidated: true, reason: String(reason), at: current.invalidatedAt, provenanceReceipt: String(provenanceReceipt) };
      const result = { ...base, receiptSha256: sha256(JSON.stringify(base)) }; next.audit.push({ type: 'invalidate', id, at: current.invalidatedAt, receiptSha256: result.receiptSha256 }); return Object.freeze(result);
    });
  }
  snapshot() { this.#ready(); const now = this.#clock(); const values = Object.values(this.#state.records); const activeRecords = values.filter((item) => item.invalidatedAt === null && (item.expiresAt === null || item.expiresAt > now)).length; return Object.freeze({ schema: this.#state.schema, records: values.length, activeRecords, auditEvents: this.#state.audit.length, file: this.#file }); }
}
