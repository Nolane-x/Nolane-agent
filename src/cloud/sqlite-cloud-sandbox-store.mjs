import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteCloudSandboxStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS cloud_sandboxes(
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        state TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cloud_sandboxes_org_state ON cloud_sandboxes(organization_id, state);
    `);
    this.saveStatement = this.db.prepare(`
      INSERT INTO cloud_sandboxes(id, organization_id, workspace_id, state, record_json, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organization_id=excluded.organization_id,
        workspace_id=excluded.workspace_id,
        state=excluded.state,
        record_json=excluded.record_json,
        updated_at=excluded.updated_at
    `);
  }
  loadAll() { return this.db.prepare('SELECT record_json FROM cloud_sandboxes ORDER BY updated_at, id').all().map((row) => JSON.parse(row.record_json)); }
  save(record) { this.saveStatement.run(record.id, record.organizationId, record.workspaceId, record.state, JSON.stringify(record), Number(record.updatedAt ?? record.createdAt ?? Date.now())); }
  close() { this.db.close(); }
}
