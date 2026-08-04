import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteEnterpriseSessionStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS enterprise_sessions(
        token_hash TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        email TEXT,
        groups_json TEXT NOT NULL,
        roles_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS enterprise_sessions_org_expiry ON enterprise_sessions(organization_id, expires_at);
    `);
  }
  loadAll() {
    return this.db.prepare('SELECT * FROM enterprise_sessions ORDER BY created_at ASC').all().map((row) => ({
      tokenHash: row.token_hash, subject: row.subject, organizationId: row.organization_id, email: row.email,
      groups: JSON.parse(row.groups_json), roles: JSON.parse(row.roles_json), createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at), revokedAt: row.revoked_at == null ? null : Number(row.revoked_at),
    }));
  }
  save(record) {
    this.db.prepare(`
      INSERT INTO enterprise_sessions(token_hash,subject,organization_id,email,groups_json,roles_json,created_at,expires_at,revoked_at)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(token_hash) DO UPDATE SET revoked_at=excluded.revoked_at, expires_at=excluded.expires_at
    `).run(record.tokenHash, record.subject, record.organizationId, record.email, JSON.stringify(record.groups ?? []), JSON.stringify(record.roles ?? []), record.createdAt, record.expiresAt, record.revokedAt);
  }
  deleteExpired(now) { return Number(this.db.prepare('DELETE FROM enterprise_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL').run(Number(now)).changes); }
  close() { this.db.close(); }
}
