import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteCloudQueueStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS cloud_jobs(
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        state TEXT NOT NULL,
        priority INTEGER NOT NULL,
        sequence INTEGER NOT NULL,
        attempts INTEGER NOT NULL,
        fencing_token INTEGER NOT NULL,
        lease_json TEXT,
        payload_json TEXT NOT NULL,
        error_json TEXT,
        result_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cloud_jobs_tenant_state_priority ON cloud_jobs(organization_id, state, priority DESC, sequence ASC);
    `);
    this.upsertStmt = this.db.prepare(`
      INSERT INTO cloud_jobs(id, organization_id, workspace_id, state, priority, sequence, attempts, fencing_token, lease_json, payload_json, error_json, result_json, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organization_id=excluded.organization_id,
        workspace_id=excluded.workspace_id,
        state=excluded.state,
        priority=excluded.priority,
        sequence=excluded.sequence,
        attempts=excluded.attempts,
        fencing_token=excluded.fencing_token,
        lease_json=excluded.lease_json,
        payload_json=excluded.payload_json,
        error_json=excluded.error_json,
        result_json=excluded.result_json,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at
    `);
  }

  leaseNext({ organizationId, workerId, leaseMs, now }) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare(`SELECT * FROM cloud_jobs WHERE organization_id = ? AND state = 'queued' ORDER BY priority DESC, sequence ASC LIMIT 1`).get(organizationId);
      if (!row) { this.db.exec('COMMIT'); return null; }
      const fencingToken = Number(row.fencing_token) + 1;
      const attempts = Number(row.attempts) + 1;
      const lease = { workerId, expiresAt: now + leaseMs };
      const result = this.db.prepare(`UPDATE cloud_jobs SET state='leased', attempts=?, fencing_token=?, lease_json=?, updated_at=? WHERE id=? AND state='queued' AND fencing_token=?`).run(attempts, fencingToken, JSON.stringify(lease), now, row.id, Number(row.fencing_token));
      if (Number(result.changes) !== 1) { this.db.exec('ROLLBACK'); return null; }
      this.db.exec('COMMIT');
      return {
        id: row.id, organizationId: row.organization_id, workspaceId: row.workspace_id,
        state: 'leased', priority: Number(row.priority), sequence: Number(row.sequence), attempts,
        fencingToken, lease, payload: JSON.parse(row.payload_json), error: row.error_json ? JSON.parse(row.error_json) : null,
        result: row.result_json ? JSON.parse(row.result_json) : null, createdAt: Number(row.created_at), updatedAt: now,
      };
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }
  loadAll() {
    return this.db.prepare('SELECT * FROM cloud_jobs ORDER BY sequence ASC').all().map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      workspaceId: row.workspace_id,
      state: row.state,
      priority: Number(row.priority),
      sequence: Number(row.sequence),
      attempts: Number(row.attempts),
      fencingToken: Number(row.fencing_token),
      lease: row.lease_json ? JSON.parse(row.lease_json) : null,
      payload: JSON.parse(row.payload_json),
      error: row.error_json ? JSON.parse(row.error_json) : null,
      result: row.result_json ? JSON.parse(row.result_json) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));
  }
  save(job) {
    this.upsertStmt.run(job.id, job.organizationId, job.workspaceId, job.state, job.priority, job.sequence, job.attempts, job.fencingToken, job.lease ? JSON.stringify(job.lease) : null, JSON.stringify(job.payload ?? {}), job.error ? JSON.stringify(job.error) : null, job.result ? JSON.stringify(job.result) : null, job.createdAt, job.updatedAt);
  }
  close() { this.db.close(); }
}
