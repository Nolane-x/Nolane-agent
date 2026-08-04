import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { assertPrincipal, principalRecord } from '../core/principals.mjs';

export class SqliteFederationEvaluationStore {
  constructor(file, { busyTimeoutMs = 5_000 } = {}) {
    this.file = path.resolve(file);
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=${Math.max(1, Math.floor(busyTimeoutMs))};`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS forge_federation_evaluations (
        receipt_sha256 TEXT PRIMARY KEY CHECK(length(receipt_sha256)=64),
        provider_id TEXT NOT NULL,
        capability_id TEXT,
        status TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        payload TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS forge_federation_eval_provider_idx ON forge_federation_evaluations(provider_id,recorded_at DESC);
    `);
  }
  close() { this.db.close(); }
  async initialize() { return { schemaVersion: 1, revision: this.db.prepare('SELECT COUNT(*) AS count FROM forge_federation_evaluations').get().count, receipts: [] }; }
  async health() { try { this.db.prepare('SELECT 1').get(); return { ok: true, backend: 'sqlite-wal' }; } catch (error) { return { ok: false, backend: 'sqlite-wal', reason: error.code ?? 'sqlite-error' }; } }
  async record(receipt, { principal }) {
    assertPrincipal(principal, { type: 'service', role: 'federation-evaluator', scope: 'evaluate' });
    const copy = structuredClone(receipt); const claimed = copy.receiptSha256; delete copy.receiptSha256;
    if (canonicalSha256(copy) !== claimed) throw new Error('Evaluation receipt digest mismatch');
    const existing = this.db.prepare('SELECT payload FROM forge_federation_evaluations WHERE receipt_sha256=?').get(claimed);
    if (existing) return JSON.parse(existing.payload);
    const stored = { ...receipt, recordedBy: principalRecord(principal), recordedAt: new Date().toISOString() };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO forge_federation_evaluations(receipt_sha256,provider_id,capability_id,status,recorded_at,payload) VALUES(?,?,?,?,?,?)').run(claimed, stored.providerId, stored.capabilityId, stored.status, stored.recordedAt, JSON.stringify(stored));
      this.db.exec('COMMIT'); return structuredClone(stored);
    } catch (error) { try { this.db.exec('ROLLBACK'); } catch {} const row = this.db.prepare('SELECT payload FROM forge_federation_evaluations WHERE receipt_sha256=?').get(claimed); if (row) return JSON.parse(row.payload); throw error; }
  }
  async get(receiptId) {
    const row = this.db.prepare('SELECT payload FROM forge_federation_evaluations WHERE receipt_sha256=?').get(receiptId);
    if (!row) throw new Error(`Unknown federation evaluation receipt: ${receiptId}`);
    const receipt = JSON.parse(row.payload); const copy = structuredClone(receipt); delete copy.recordedBy; delete copy.recordedAt; const claimed = copy.receiptSha256; delete copy.receiptSha256;
    if (canonicalSha256(copy) !== claimed) throw new Error('Stored evaluation receipt integrity failure');
    return receipt;
  }
}
