import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteWorkspaceTrustStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.closed = false;
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS workspace_trust_decisions(
        project_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        workspace_root TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_trust_audit(
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        project_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workspace_trust_audit_project_seq
        ON workspace_trust_audit(project_id, seq);
    `);
    this.saveStatement = this.db.prepare(`
      INSERT INTO workspace_trust_decisions(project_id,state,workspace_root,fingerprint,record_json,updated_at)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(project_id) DO UPDATE SET
        state=excluded.state,
        workspace_root=excluded.workspace_root,
        fingerprint=excluded.fingerprint,
        record_json=excluded.record_json,
        updated_at=excluded.updated_at
    `);
  }

  get(projectId) {
    const row = this.db.prepare('SELECT record_json FROM workspace_trust_decisions WHERE project_id=?').get(String(projectId));
    return row ? JSON.parse(row.record_json) : null;
  }

  save(record) {
    this.saveStatement.run(record.projectId, record.state, record.workspaceRoot, record.fingerprint, JSON.stringify(record), record.updatedAt);
  }

  appendAudit(event) {
    this.db.prepare('INSERT INTO workspace_trust_audit(id,project_id,event_json,at) VALUES(?,?,?,?)')
      .run(event.id, event.projectId, JSON.stringify(event), event.at);
  }

  listAudit(projectId, { limit = 500 } = {}) {
    const bounded = Math.max(1, Math.min(5_000, Number(limit) || 500));
    return this.db.prepare('SELECT event_json FROM workspace_trust_audit WHERE project_id=? ORDER BY seq DESC LIMIT ?')
      .all(String(projectId), bounded).map((row) => JSON.parse(row.event_json)).reverse();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}
