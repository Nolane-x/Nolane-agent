import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteScimStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS scim_users(
        organization_id TEXT NOT NULL,
        id TEXT NOT NULL,
        username TEXT NOT NULL,
        record_json TEXT NOT NULL,
        PRIMARY KEY(organization_id, id),
        UNIQUE(organization_id, username)
      );
      CREATE TABLE IF NOT EXISTS scim_groups(
        organization_id TEXT NOT NULL,
        id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        record_json TEXT NOT NULL,
        PRIMARY KEY(organization_id, id)
      );
    `);
  }
  loadState() {
    return {
      users: this.db.prepare('SELECT record_json FROM scim_users ORDER BY organization_id, id').all().map((row) => JSON.parse(row.record_json)),
      groups: this.db.prepare('SELECT record_json FROM scim_groups ORDER BY organization_id, id').all().map((row) => JSON.parse(row.record_json)),
    };
  }
  saveUser(record) {
    try {
      this.db.prepare(`INSERT INTO scim_users(organization_id,id,username,record_json) VALUES(?,?,?,?)
        ON CONFLICT(organization_id,id) DO UPDATE SET username=excluded.username,record_json=excluded.record_json`).run(record.organizationId, record.id, record.userName, JSON.stringify(record));
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) throw Object.assign(new Error('SCIM userName already exists'), { statusCode: 409, code: 'scim-username-conflict' });
      throw error;
    }
  }
  saveGroup(record) { this.db.prepare(`INSERT INTO scim_groups(organization_id,id,display_name,record_json) VALUES(?,?,?,?) ON CONFLICT(organization_id,id) DO UPDATE SET display_name=excluded.display_name,record_json=excluded.record_json`).run(record.organizationId, record.id, record.displayName, JSON.stringify(record)); }
  deleteGroup(organizationId, id) { this.db.prepare('DELETE FROM scim_groups WHERE organization_id=? AND id=?').run(organizationId, id); }
  close() { this.db.close(); }
}
