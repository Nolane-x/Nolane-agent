import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteEnterpriseStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS enterprise_organizations(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS enterprise_members(
        organization_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        roles_json TEXT NOT NULL,
        active INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(organization_id, principal_id),
        FOREIGN KEY(organization_id) REFERENCES enterprise_organizations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS enterprise_policies(
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        effect TEXT NOT NULL,
        principals_json TEXT NOT NULL,
        roles_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        resources_json TEXT NOT NULL,
        conditions_json TEXT NOT NULL,
        FOREIGN KEY(organization_id) REFERENCES enterprise_organizations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS enterprise_audit(
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        decision TEXT NOT NULL,
        code TEXT NOT NULL,
        policy_id TEXT,
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS enterprise_audit_org_seq ON enterprise_audit(organization_id, seq);
    `);
  }
  loadState() {
    const organizations = this.db.prepare('SELECT * FROM enterprise_organizations ORDER BY id').all().map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, metadata: JSON.parse(row.metadata_json) }));
    const members = this.db.prepare('SELECT * FROM enterprise_members ORDER BY organization_id, principal_id').all().map((row) => ({ organizationId: row.organization_id, principalId: row.principal_id, roles: JSON.parse(row.roles_json), active: Boolean(row.active), updatedAt: row.updated_at }));
    const policies = this.db.prepare('SELECT * FROM enterprise_policies ORDER BY id').all().map((row) => ({ id: row.id, organizationId: row.organization_id, effect: row.effect, principals: JSON.parse(row.principals_json), roles: JSON.parse(row.roles_json), actions: JSON.parse(row.actions_json), resources: JSON.parse(row.resources_json), conditions: JSON.parse(row.conditions_json) }));
    const audit = this.db.prepare('SELECT id, organization_id, principal_id, action, resource, decision, code, policy_id, at FROM enterprise_audit ORDER BY seq').all().map((row) => ({ id: row.id, organizationId: row.organization_id, principalId: row.principal_id, action: row.action, resource: row.resource, decision: row.decision, code: row.code, policyId: row.policy_id, at: row.at }));
    return { organizations, members, policies, audit };
  }
  saveOrganization(record) { this.db.prepare('INSERT INTO enterprise_organizations(id,name,created_at,metadata_json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, metadata_json=excluded.metadata_json').run(record.id, record.name, record.createdAt, JSON.stringify(record.metadata ?? {})); }
  saveMember(record) { this.db.prepare('INSERT INTO enterprise_members(organization_id,principal_id,roles_json,active,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(organization_id,principal_id) DO UPDATE SET roles_json=excluded.roles_json,active=excluded.active,updated_at=excluded.updated_at').run(record.organizationId, record.principalId, JSON.stringify(record.roles ?? []), record.active ? 1 : 0, record.updatedAt); }
  savePolicy(record) { this.db.prepare('INSERT INTO enterprise_policies(id,organization_id,effect,principals_json,roles_json,actions_json,resources_json,conditions_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET effect=excluded.effect,principals_json=excluded.principals_json,roles_json=excluded.roles_json,actions_json=excluded.actions_json,resources_json=excluded.resources_json,conditions_json=excluded.conditions_json').run(record.id, record.organizationId, record.effect, JSON.stringify(record.principals ?? []), JSON.stringify(record.roles ?? []), JSON.stringify(record.actions ?? []), JSON.stringify(record.resources ?? []), JSON.stringify(record.conditions ?? {})); }
  appendAudit(record) { this.db.prepare('INSERT INTO enterprise_audit(id,organization_id,principal_id,action,resource,decision,code,policy_id,at) VALUES(?,?,?,?,?,?,?,?,?)').run(record.id, record.organizationId, record.principalId, record.action, record.resource, record.decision, record.code, record.policyId, record.at); }
  close() { this.db.close(); }
}
