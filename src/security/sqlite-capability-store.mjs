import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteCapabilityStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS capability_grants(
        id TEXT PRIMARY KEY,
        principal_id TEXT NOT NULL,
        effect TEXT NOT NULL,
        mode TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS capability_grants_principal ON capability_grants(principal_id, effect, mode);
      CREATE TABLE IF NOT EXISTS capability_audit(
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        principal_id TEXT,
        event_json TEXT NOT NULL,
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS capability_audit_principal_seq ON capability_audit(principal_id, seq);
    `);
    this.saveGrantStatement = this.db.prepare(`
      INSERT INTO capability_grants(id, principal_id, effect, mode, record_json, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        principal_id=excluded.principal_id,
        effect=excluded.effect,
        mode=excluded.mode,
        record_json=excluded.record_json,
        updated_at=excluded.updated_at
    `);
  }

  loadState() {
    const grants = this.db.prepare('SELECT record_json FROM capability_grants ORDER BY id').all().map((row) => JSON.parse(row.record_json));
    const audit = this.db.prepare('SELECT event_json FROM capability_audit ORDER BY seq').all().map((row) => JSON.parse(row.event_json));
    return { grants, audit };
  }

  saveGrant(record) {
    this.saveGrantStatement.run(record.id, record.principalId, record.effect, record.mode, JSON.stringify(record), record.amendedAt ?? record.revokedAt ?? record.createdAt);
  }

  appendAudit(event) {
    this.db.prepare('INSERT INTO capability_audit(id,type,principal_id,event_json,at) VALUES(?,?,?,?,?)')
      .run(event.id, event.type, event.principalId ?? null, JSON.stringify(event), event.at);
  }

  close() { this.db.close(); }
}
