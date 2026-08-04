import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

import { createProjectAccess } from '../core/project-access.mjs';
import { validateProjectId } from '../core/contracts.mjs';
import { ASSURANCE_LEVELS, DOMAIN_PACKS } from '../core/constants.mjs';
import { assertSafeValue, assertNoSecrets } from '../core/security.mjs';
import { migrateProject } from '../core/migrations.mjs';
import { validateProjectAggregate } from '../core/project-validator.mjs';
import { validateRuntimeSchema } from '../core/runtime-schemas.mjs';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { initializeAudit, appendAuditEvent } from '../core/audit-chain.mjs';
import { RevisionConflictError } from '../core/project-store.mjs';

const now = () => new Date().toISOString();
const ACTIVE_GATE = (gate, revision, timestamp) => gate.status === 'pass' && gate.evaluatedSemanticRevision !== revision
  ? { ...gate, status: 'stale', staleAt: timestamp, staleReason: 'project-semantic-revision-changed' }
  : gate;

function initialProject({ name, domain, assurance, metadata, principal }) {
  assertSafeValue(metadata); assertNoSecrets(metadata);
  if (domain !== 'all' && !DOMAIN_PACKS.includes(domain)) throw new TypeError(`Unknown domain: ${domain}`);
  if (!ASSURANCE_LEVELS.includes(assurance)) throw new TypeError(`Unknown assurance level: ${assurance}`);
  const id = `forge_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const timestamp = now();
  const project = {
    schemaVersion: 5, revision: 1, semanticRevision: 1, id,
    name: String(name).trim().slice(0, 300) || 'Untitled project', domain, assurance, stage: 'intent',
    createdAt: timestamp, updatedAt: timestamp, access: createProjectAccess(principal ?? undefined), metadata: structuredClone(metadata),
    intent: null, brief: null, research: [], ideas: [], scores: [], selectedIdeaId: null, selectionReason: null,
    decisions: [], artifacts: [], evidence: [], gates: [], findings: [], risks: [], routes: [], skillUtility: {}, skillRuns: [],
    pendingApprovals: [], sealedAt: null, releaseRevision: null,
    history: [{ type: 'project-created', stage: 'intent', at: timestamp }], audit: null,
  };
  project.audit = initializeAudit(project, { type: 'project-created', at: timestamp });
  return project;
}
function validate(project) {
  const migrated = migrateProject(project);
  validateRuntimeSchema('project', migrated);
  validateProjectAggregate(migrated);
  return migrated;
}
function serialize(project) { assertSafeValue(project); assertNoSecrets(project); validate(project); return JSON.stringify(project); }
function parse(value) { return validate(JSON.parse(value)); }

export class SqliteProjectStore {
  constructor(file, { snapshotLimit = 8, busyTimeoutMs = 5_000 } = {}) {
    this.file = path.resolve(file);
    this.snapshotLimit = snapshotLimit;
    this.diagnosticsState = [];
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=${Math.max(1, Math.floor(busyTimeoutMs))};`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS forge_projects (
        project_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK(revision >= 1),
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS forge_snapshots (
        project_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK(revision >= 1),
        project_sha256 TEXT NOT NULL CHECK(length(project_sha256)=64),
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY(project_id, revision),
        FOREIGN KEY(project_id) REFERENCES forge_projects(project_id) ON DELETE CASCADE
      ) STRICT;
      CREATE INDEX IF NOT EXISTS forge_projects_updated_idx ON forge_projects(updated_at DESC);
    `);
  }
  diagnostics() { return structuredClone(this.diagnosticsState); }
  close() { this.db.close(); }
  async health() { try { this.db.prepare('SELECT 1 AS ok').get(); return { ok: true, backend: 'sqlite-wal' }; } catch (error) { return { ok: false, backend: 'sqlite-wal', reason: error.code ?? 'sqlite-error' }; } }
  async create({ name = 'Untitled project', domain = 'all', assurance = 'A1', metadata = {}, principal = null } = {}) {
    const project = initialProject({ name, domain, assurance, metadata, principal });
    const payload = serialize(project);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO forge_projects(project_id,revision,updated_at,payload) VALUES(?,?,?,?)').run(project.id, project.revision, project.updatedAt, payload);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return structuredClone(project);
  }
  async read(id) {
    validateProjectId(id);
    const row = this.db.prepare('SELECT payload FROM forge_projects WHERE project_id=?').get(id);
    if (!row) { const error = new Error(`Unknown project: ${id}`); error.code = 'ENOENT'; throw error; }
    return structuredClone(parse(row.payload));
  }
  async update(id, updater, { expectedRevision = null, semantic = true, allowReleased = false } = {}) {
    validateProjectId(id);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT payload,revision FROM forge_projects WHERE project_id=?').get(id);
      if (!row) { const error = new Error(`Unknown project: ${id}`); error.code = 'ENOENT'; throw error; }
      const project = parse(row.payload);
      if (expectedRevision !== null && project.revision !== expectedRevision) throw new RevisionConflictError(expectedRevision, project.revision);
      if (project.stage === 'released' && !allowReleased) throw new Error('Released projects are sealed and cannot be mutated');
      const candidate = updater(structuredClone(project));
      if (candidate && typeof candidate.then === 'function') throw new TypeError('SQLite project updater must be synchronous');
      if (!candidate || typeof candidate !== 'object' || candidate.id !== id) throw new TypeError('Project updater must return the same project');
      if (this.snapshotLimit > 0) {
        const wrapper = { revision: project.revision, projectSha256: canonicalSha256(project), createdAt: now(), project };
        this.db.prepare(`INSERT OR IGNORE INTO forge_snapshots(project_id,revision,project_sha256,created_at,payload) VALUES(?,?,?,?,?)`).run(id, project.revision, wrapper.projectSha256, wrapper.createdAt, JSON.stringify(wrapper));
      }
      const timestamp = now();
      candidate.schemaVersion = 5;
      candidate.revision = project.revision + 1;
      candidate.semanticRevision = project.semanticRevision + (semantic ? 1 : 0);
      candidate.createdAt = project.createdAt;
      candidate.updatedAt = timestamp;
      if (semantic) candidate.gates = (candidate.gates ?? []).map((gate) => ACTIVE_GATE(gate, candidate.semanticRevision, timestamp));
      candidate.audit = appendAuditEvent(candidate, { type: semantic ? 'project-semantic-update' : 'project-operational-update', at: timestamp, metadata: { previousRevision: project.revision } });
      const payload = serialize(candidate);
      const result = this.db.prepare('UPDATE forge_projects SET revision=?,updated_at=?,payload=? WHERE project_id=? AND revision=?').run(candidate.revision, candidate.updatedAt, payload, id, project.revision);
      if (result.changes !== 1) throw new RevisionConflictError(project.revision, this.db.prepare('SELECT revision FROM forge_projects WHERE project_id=?').get(id)?.revision ?? -1);
      if (this.snapshotLimit > 0) this.db.prepare(`DELETE FROM forge_snapshots WHERE project_id=? AND revision NOT IN (SELECT revision FROM forge_snapshots WHERE project_id=? ORDER BY revision DESC LIMIT ?)`).run(id, id, this.snapshotLimit);
      this.db.exec('COMMIT');
      return structuredClone(candidate);
    } catch (error) { try { this.db.exec('ROLLBACK'); } catch {} throw error; }
  }
  async list() {
    this.diagnosticsState = [];
    const projects = [];
    for (const row of this.db.prepare('SELECT project_id,payload FROM forge_projects ORDER BY updated_at DESC').all()) {
      try { projects.push(parse(row.payload)); }
      catch (error) { this.diagnosticsState.push({ file: row.project_id, code: 'corrupt-project', message: error.message, observedAt: now() }); }
    }
    return structuredClone(projects);
  }
  async listSnapshots(id) {
    validateProjectId(id);
    return this.db.prepare('SELECT revision,project_sha256 AS projectSha256,created_at AS createdAt FROM forge_snapshots WHERE project_id=? ORDER BY revision').all(id);
  }
  async verifySnapshot(id, revision) {
    validateProjectId(id);
    const row = this.db.prepare('SELECT project_sha256,payload FROM forge_snapshots WHERE project_id=? AND revision=?').get(id, revision);
    if (!row) throw new Error(`Unknown snapshot: ${id}@${revision}`);
    const wrapper = JSON.parse(row.payload); const actual = canonicalSha256(wrapper.project);
    return { valid: actual === row.project_sha256, revision, expectedSha256: row.project_sha256, actualSha256: actual };
  }
  async restoreSnapshot(id, revision, { expectedRevision = null, transform = null } = {}) {
    validateProjectId(id);
    const row = this.db.prepare('SELECT project_sha256,payload FROM forge_snapshots WHERE project_id=? AND revision=?').get(id, revision);
    if (!row) throw new Error(`Unknown snapshot: ${id}@${revision}`);
    const wrapper = JSON.parse(row.payload);
    if (canonicalSha256(wrapper.project) !== row.project_sha256) throw new Error('Snapshot checksum mismatch');
    return this.update(id, (current) => {
      const restored = structuredClone(wrapper.project);
      restored.id = current.id; restored.createdAt = current.createdAt; restored.access = structuredClone(current.access);
      restored.pendingApprovals = structuredClone(current.pendingApprovals); restored.audit = current.audit;
      if (transform) Object.assign(restored, transform(structuredClone(current), structuredClone(restored)) ?? restored);
      restored.history = [...(restored.history ?? []), { type: 'snapshot-restored', fromRevision: revision, previousRevision: current.revision, at: now() }];
      restored.sealedAt = null; restored.releaseRevision = null; return restored;
    }, { expectedRevision, semantic: true, allowReleased: true });
  }
  async exportBundle(id) {
    const project = await this.read(id); const content = `${JSON.stringify(project, null, 2)}\n`;
    return { projectId: id, fileName: `${id}.forge.json`, mimeType: 'application/vnd.forgeos.project+json', sha256: createHash('sha256').update(content).digest('hex'), revision: project.revision, content };
  }
}
