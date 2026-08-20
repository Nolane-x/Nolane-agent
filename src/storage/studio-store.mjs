import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { normalizeTaskContract } from '../orchestration/task-contract.mjs';

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
const parse = (value, fallback) => value == null ? fallback : JSON.parse(value);
const encode = (value) => JSON.stringify(value ?? null);


function publicMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const blocked = /(?:secret|private|password|credential|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;
  const walk = (input) => {
    if (Array.isArray(input)) return input.map(walk);
    if (!input || typeof input !== 'object') return input;
    const out = {};
    for (const [key, item] of Object.entries(input)) {
      if (blocked.test(key)) continue;
      out[key] = walk(item);
    }
    return out;
  };
  return walk(value);
}

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

export class StudioStore {
  constructor(file, { eventHub = null } = {}) {
    this.eventHub = eventHub;
    this.file = path.resolve(required(file, 'database file'));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.#migrate();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        workspace_root TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS missions(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        role TEXT,
        dependencies_json TEXT NOT NULL,
        allowed_paths_json TEXT NOT NULL,
        denied_paths_json TEXT NOT NULL,
        lease_owner TEXT,
        lease_expires_at TEXT,
        fencing_token INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_mission_status ON tasks(mission_id, status);
      CREATE TABLE IF NOT EXISTS runs(
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        state TEXT NOT NULL,
        checkpoint_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS approvals(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        request_json TEXT NOT NULL,
        decision_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS interrupts(
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        prompt_json TEXT NOT NULL,
        resume_token_sha256 TEXT NOT NULL,
        create_idempotency_key TEXT NOT NULL UNIQUE,
        resume_idempotency_key TEXT UNIQUE,
        response_json TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS interrupts_status_expiry ON interrupts(status,expires_at);
      CREATE TABLE IF NOT EXISTS providers(
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evidence(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        receipt_sha256 TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS repository_files(
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        language TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        line_count INTEGER NOT NULL,
        content TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        PRIMARY KEY(project_id,path)
      );
      CREATE INDEX IF NOT EXISTS repository_files_sha ON repository_files(project_id,sha256);
      CREATE TABLE IF NOT EXISTS repository_symbols(
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        line INTEGER NOT NULL,
        signature TEXT NOT NULL,
        PRIMARY KEY(project_id,path,kind,name,line),
        FOREIGN KEY(project_id,path) REFERENCES repository_files(project_id,path) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS repository_symbols_name ON repository_symbols(project_id,name);
      CREATE TABLE IF NOT EXISTS memory_items(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL NOT NULL,
        source_task_id TEXT,
        evidence_receipt_sha256 TEXT,
        actor TEXT,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS memory_items_project_status ON memory_items(project_id,status,updated_at);
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(id UNINDEXED, project_id UNINDEXED, title, content, tokenize='unicode61');
      CREATE TABLE IF NOT EXISTS conversation_messages(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS conversation_messages_mission_time ON conversation_messages(mission_id,created_at,id);
      CREATE TABLE IF NOT EXISTS autonomy_grants(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        profile TEXT NOT NULL,
        status TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS autonomy_grants_project_status ON autonomy_grants(project_id,status,updated_at);
      CREATE UNIQUE INDEX IF NOT EXISTS autonomy_grants_one_active_per_project ON autonomy_grants(project_id) WHERE status='active';
      CREATE TABLE IF NOT EXISTS goals(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        success_criteria_json TEXT NOT NULL,
        budget_json TEXT NOT NULL,
        schedule_json TEXT NOT NULL,
        assumptions_json TEXT NOT NULL,
        active_mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS goals_project_status ON goals(project_id,status,updated_at);
      CREATE TABLE IF NOT EXISTS goal_missions(
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        relation TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(goal_id,mission_id)
      );
      CREATE TABLE IF NOT EXISTS goal_facts(
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        claim TEXT NOT NULL,
        confidence REAL NOT NULL,
        impact TEXT NOT NULL,
        status TEXT NOT NULL,
        source_json TEXT NOT NULL,
        receipt_sha256 TEXT,
        invalidates_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS goal_facts_goal_time ON goal_facts(goal_id,created_at,id);
      CREATE TABLE IF NOT EXISTS goal_plan_revisions(
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        summary TEXT NOT NULL,
        reason TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(goal_id,revision)
      );
      CREATE INDEX IF NOT EXISTS goal_plan_revisions_goal ON goal_plan_revisions(goal_id,revision);
      CREATE TABLE IF NOT EXISTS goal_plan_patches(
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        base_revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        patch_json TEXT NOT NULL,
        idempotency_key TEXT,
        created_at TEXT NOT NULL,
        applied_at TEXT,
        UNIQUE(goal_id,idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS goal_plan_patches_goal ON goal_plan_patches(goal_id,created_at,id);
      CREATE TABLE IF NOT EXISTS goal_schedule_state(
        goal_id TEXT PRIMARY KEY REFERENCES goals(id) ON DELETE CASCADE,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events(
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        schema TEXT NOT NULL,
        time TEXT NOT NULL,
        type TEXT NOT NULL,
        refs_json TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS events_no_update
      BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS events_no_delete
      BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
      INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(1, CURRENT_TIMESTAMP);
    `);
  }

  snapshotTo(file) {
    const target = path.resolve(required(file, 'snapshot file'));
    if (target === this.file) throw new Error('Snapshot target must differ from the live database');
    mkdirSync(path.dirname(target), { recursive: true });
    rmSync(target, { force: true });
    const escaped = target.replaceAll("'", "''");
    this.db.exec(`VACUUM INTO '${escaped}'`);
    return Object.freeze({ source: this.file, target });
  }

  close() {
    if (!this.db) return;
    const db = this.db;
    this.db = null;
    db.close();
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { try { this.db.exec('ROLLBACK'); } catch {} throw error; }
  }

  createProject({ id: projectId = id('project'), name, workspaceRoot, metadata = {} }) {
    const stamp = now();
    const record = { id: projectId, name: required(name, 'project name'), workspaceRoot: path.resolve(required(workspaceRoot, 'workspaceRoot')), createdAt: stamp, updatedAt: stamp, metadata: publicMetadata(structuredClone(metadata)) };
    this.db.prepare('INSERT INTO projects(id,name,workspace_root,created_at,updated_at,metadata_json) VALUES(?,?,?,?,?,?)')
      .run(record.id, record.name, record.workspaceRoot, record.createdAt, record.updatedAt, encode(record.metadata));
    return Object.freeze(record);
  }

  getProject(projectId) {
    const row = this.db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
    return row ? this.#project(row) : null;
  }

  listProjects() { return this.db.prepare('SELECT * FROM projects ORDER BY created_at,id').all().map((row) => this.#project(row)); }

  upsertProvider({ id: providerId, kind, config = {} }) {
    const stamp = now();
    const cleanId = required(providerId, 'provider id');
    const cleanKind = required(kind, 'provider kind');
    const cleanConfig = publicMetadata(structuredClone(config));
    this.db.prepare(`INSERT INTO providers(id,kind,config_json,created_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,config_json=excluded.config_json,updated_at=excluded.updated_at`)
      .run(cleanId, cleanKind, encode(cleanConfig), stamp, stamp);
    return Object.freeze(this.getProviderConfig(cleanId));
  }

  getProviderConfig(providerId) {
    const row = this.db.prepare('SELECT * FROM providers WHERE id=?').get(String(providerId));
    return row ? this.#provider(row) : null;
  }

  listProviderConfigs() {
    return this.db.prepare('SELECT * FROM providers ORDER BY created_at,id').all().map((row) => this.#provider(row));
  }

  deleteProviderConfig(providerId) {
    return this.db.prepare('DELETE FROM providers WHERE id=?').run(String(providerId)).changes > 0;
  }

  #provider(row) { return { id: row.id, kind: row.kind, config: parse(row.config_json, {}), createdAt: row.created_at, updatedAt: row.updated_at }; }

  #project(row) { return { id: row.id, name: row.name, workspaceRoot: row.workspace_root, createdAt: row.created_at, updatedAt: row.updated_at, metadata: parse(row.metadata_json, {}) }; }

  createMission({ id: missionId = id('mission'), projectId, objective, status = 'planned', metadata = {} }) {
    if (!this.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    const stamp = now();
    const record = { id: missionId, projectId, objective: required(objective, 'mission objective'), status, createdAt: stamp, updatedAt: stamp, metadata: publicMetadata(structuredClone(metadata)) };
    this.db.prepare('INSERT INTO missions(id,project_id,objective,status,created_at,updated_at,metadata_json) VALUES(?,?,?,?,?,?,?)')
      .run(record.id, projectId, record.objective, status, stamp, stamp, encode(record.metadata));
    return Object.freeze(record);
  }

  getMission(missionId) {
    const row = this.db.prepare('SELECT * FROM missions WHERE id=?').get(missionId);
    return row ? { id: row.id, projectId: row.project_id, objective: row.objective, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, metadata: parse(row.metadata_json, {}) } : null;
  }

  listMissions({ projectId = null, status = null } = {}) {
    const clauses = []; const values = [];
    if (projectId) { clauses.push('project_id=?'); values.push(projectId); }
    if (status) { clauses.push('status=?'); values.push(status); }
    const sql = `SELECT * FROM missions${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,id`;
    return this.db.prepare(sql).all(...values).map((row) => ({ id: row.id, projectId: row.project_id, objective: row.objective, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, metadata: parse(row.metadata_json, {}) }));
  }

  updateMission(missionId, changes = {}) {
    const current = this.getMission(missionId);
    if (!current) throw new Error(`Unknown mission: ${missionId}`);
    const next = { ...current, ...structuredClone(changes), id: current.id, projectId: current.projectId, createdAt: current.createdAt, updatedAt: now() };
    this.db.prepare('UPDATE missions SET objective=?,status=?,updated_at=?,metadata_json=? WHERE id=?')
      .run(next.objective, next.status, next.updatedAt, encode(next.metadata), missionId);
    return Object.freeze(next);
  }

  createTask({ id: taskId = id('task'), projectId, missionId = null, title, objective, status = 'todo', role = null, dependencies = [], allowedPaths = ['**'], deniedPaths = [], metadata = {} }) {
    if (!this.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    if (missionId && !this.getMission(missionId)) throw new Error(`Unknown mission: ${missionId}`);
    const normalizedObjective = required(objective, 'task objective');
    const normalizedMetadata = structuredClone(metadata);
    if (normalizedMetadata.taskContract !== undefined) {
      const contract = normalizeTaskContract(normalizedMetadata.taskContract);
      if (contract.objective !== normalizedObjective) throw new TypeError('task objective must exactly match taskContract objective');
      normalizedMetadata.taskContract = contract;
      allowedPaths = contract.scope.allowedPaths;
      deniedPaths = contract.scope.deniedPaths;
    }
    const stamp = now();
    const record = { id: taskId, projectId, missionId, title: required(title, 'task title'), objective: normalizedObjective, status, role, dependencies: [...dependencies], allowedPaths: [...allowedPaths], deniedPaths: [...deniedPaths], leaseOwner: null, leaseExpiresAt: null, fencingToken: 0, createdAt: stamp, updatedAt: stamp, metadata: normalizedMetadata };
    this.db.prepare(`INSERT INTO tasks(id,project_id,mission_id,title,objective,status,role,dependencies_json,allowed_paths_json,denied_paths_json,lease_owner,lease_expires_at,fencing_token,created_at,updated_at,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(record.id, projectId, missionId, record.title, record.objective, status, role, encode(record.dependencies), encode(record.allowedPaths), encode(record.deniedPaths), null, null, 0, stamp, stamp, encode(record.metadata));
    return Object.freeze(record);
  }

  getTask(taskId) {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id=?').get(taskId);
    return row ? this.#task(row) : null;
  }

  listTasks({ projectId = null, missionId = null, status = null } = {}) {
    const clauses = []; const values = [];
    if (projectId) { clauses.push('project_id=?'); values.push(projectId); }
    if (missionId) { clauses.push('mission_id=?'); values.push(missionId); }
    if (status) { clauses.push('status=?'); values.push(status); }
    const sql = `SELECT * FROM tasks${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,id`;
    return this.db.prepare(sql).all(...values).map((row) => this.#task(row));
  }

  updateTask(taskId, changes = {}) {
    const current = this.getTask(taskId);
    if (!current) throw new Error(`Unknown task: ${taskId}`);
    const next = {
      ...current,
      ...structuredClone(changes),
      id: current.id,
      projectId: current.projectId,
      missionId: current.missionId,
      createdAt: current.createdAt,
      updatedAt: now(),
    };
    this.db.prepare(`UPDATE tasks SET title=?,objective=?,status=?,role=?,dependencies_json=?,allowed_paths_json=?,denied_paths_json=?,lease_owner=?,lease_expires_at=?,fencing_token=?,updated_at=?,metadata_json=? WHERE id=?`)
      .run(next.title, next.objective, next.status, next.role, encode(next.dependencies), encode(next.allowedPaths), encode(next.deniedPaths), next.leaseOwner, next.leaseExpiresAt, next.fencingToken, next.updatedAt, encode(next.metadata), taskId);
    return Object.freeze(next);
  }

  #task(row) {
    return { id: row.id, projectId: row.project_id, missionId: row.mission_id, title: row.title, objective: row.objective, status: row.status, role: row.role, dependencies: parse(row.dependencies_json, []), allowedPaths: parse(row.allowed_paths_json, []), deniedPaths: parse(row.denied_paths_json, []), leaseOwner: row.lease_owner, leaseExpiresAt: row.lease_expires_at, fencingToken: row.fencing_token, createdAt: row.created_at, updatedAt: row.updated_at, metadata: parse(row.metadata_json, {}) };
  }

  createRun({ id: runId = id('run'), taskId, providerId, state = 'created', checkpoint = {} }) {
    if (!this.getTask(taskId)) throw new Error(`Unknown task: ${taskId}`);
    const stamp = now();
    const record = { id: runId, taskId, providerId: required(providerId, 'providerId'), state, checkpoint: structuredClone(checkpoint), createdAt: stamp, updatedAt: stamp };
    this.db.prepare('INSERT INTO runs(id,task_id,provider_id,state,checkpoint_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
      .run(record.id, record.taskId, record.providerId, record.state, encode(record.checkpoint), stamp, stamp);
    return Object.freeze(record);
  }

  getRun(runId) {
    const row = this.db.prepare('SELECT * FROM runs WHERE id=?').get(runId);
    return row ? this.#run(row) : null;
  }

  listRuns({ taskId = null, state = null } = {}) {
    const clauses = []; const values = [];
    if (taskId) { clauses.push('task_id=?'); values.push(taskId); }
    if (state) { clauses.push('state=?'); values.push(state); }
    const sql = `SELECT * FROM runs${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,id`;
    return this.db.prepare(sql).all(...values).map((row) => this.#run(row));
  }

  updateRun(runId, { state, checkpoint } = {}) {
    const current = this.getRun(runId);
    if (!current) throw new Error(`Unknown run: ${runId}`);
    const next = { ...current, state: state ?? current.state, checkpoint: checkpoint === undefined ? current.checkpoint : structuredClone(checkpoint), updatedAt: now() };
    this.db.prepare('UPDATE runs SET state=?,checkpoint_json=?,updated_at=? WHERE id=?')
      .run(next.state, encode(next.checkpoint), next.updatedAt, runId);
    return Object.freeze(next);
  }

  #run(row) {
    return { id: row.id, taskId: row.task_id, providerId: row.provider_id, state: row.state, checkpoint: parse(row.checkpoint_json, {}), createdAt: row.created_at, updatedAt: row.updated_at };
  }


  createInterrupt({ id: interruptId = id('interrupt'), missionId, taskId = null, kind = 'operator-input', prompt = {}, resumeTokenSha256, idempotencyKey, expiresAt, createdAt = now() }) {
    if (!this.getMission(missionId)) throw new Error(`Unknown mission: ${missionId}`);
    if (taskId && !this.getTask(taskId)) throw new Error(`Unknown task: ${taskId}`);
    const existing = this.db.prepare('SELECT * FROM interrupts WHERE create_idempotency_key=?').get(required(idempotencyKey, 'interrupt idempotencyKey'));
    if (existing) return Object.freeze({ record: this.#interrupt(existing, true), created: false });
    const stamp = String(createdAt);
    this.db.prepare(`INSERT INTO interrupts(id,mission_id,task_id,kind,status,prompt_json,resume_token_sha256,create_idempotency_key,resume_idempotency_key,response_json,expires_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(interruptId, missionId, taskId, required(kind, 'interrupt kind'), 'pending', encode(prompt), required(resumeTokenSha256, 'resumeTokenSha256'), idempotencyKey, null, null, String(expiresAt), stamp, stamp);
    return Object.freeze({ record: this.getInterrupt(interruptId, { internal: true }), created: true });
  }

  getInterrupt(interruptId, { internal = false } = {}) {
    const row = this.db.prepare('SELECT * FROM interrupts WHERE id=?').get(interruptId);
    return row ? this.#interrupt(row, internal) : null;
  }

  listInterrupts({ missionId = null, taskId = null, status = null, internal = false } = {}) {
    const clauses = []; const values = [];
    if (missionId) { clauses.push('mission_id=?'); values.push(missionId); }
    if (taskId) { clauses.push('task_id=?'); values.push(taskId); }
    if (status) { clauses.push('status=?'); values.push(status); }
    const sql = `SELECT * FROM interrupts${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,id`;
    return this.db.prepare(sql).all(...values).map((row) => this.#interrupt(row, internal));
  }

  updateInterrupt(interruptId, { status, response, resumeIdempotencyKey, updatedAt = now() } = {}) {
    const current = this.getInterrupt(interruptId, { internal: true });
    if (!current) throw new Error(`Unknown interrupt: ${interruptId}`);
    const next = {
      ...current,
      status: status ?? current.status,
      response: response === undefined ? current.response : structuredClone(response),
      resumeIdempotencyKey: resumeIdempotencyKey === undefined ? current.resumeIdempotencyKey : resumeIdempotencyKey,
      updatedAt: String(updatedAt),
    };
    this.db.prepare('UPDATE interrupts SET status=?,response_json=?,resume_idempotency_key=?,updated_at=? WHERE id=?')
      .run(next.status, next.response == null ? null : encode(next.response), next.resumeIdempotencyKey, next.updatedAt, interruptId);
    return this.getInterrupt(interruptId, { internal: true });
  }

  #interrupt(row, internal = false) {
    const value = {
      id: row.id, missionId: row.mission_id, taskId: row.task_id, kind: row.kind, status: row.status,
      prompt: parse(row.prompt_json, {}), createIdempotencyKey: row.create_idempotency_key,
      resumeIdempotencyKey: row.resume_idempotency_key, response: parse(row.response_json, null),
      expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at,
    };
    if (internal) value.resumeTokenSha256 = row.resume_token_sha256;
    return value;
  }

  addEvidence({ id: evidenceId = id('evidence'), projectId, taskId = null, kind, status = 'unverified', payload = {}, receiptSha256 = null }) {
    if (!this.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    if (taskId && !this.getTask(taskId)) throw new Error(`Unknown task: ${taskId}`);
    const record = { id: evidenceId, projectId, taskId, kind: required(kind, 'evidence kind'), status: String(status), payload: structuredClone(payload), receiptSha256, createdAt: now() };
    this.db.prepare('INSERT INTO evidence(id,project_id,task_id,kind,status,payload_json,receipt_sha256,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(record.id, record.projectId, record.taskId, record.kind, record.status, encode(record.payload), record.receiptSha256, record.createdAt);
    return Object.freeze(record);
  }

  listEvidence({ projectId = null, taskId = null, status = null } = {}) {
    const clauses = []; const values = [];
    if (projectId) { clauses.push('project_id=?'); values.push(projectId); }
    if (taskId) { clauses.push('task_id=?'); values.push(taskId); }
    if (status) { clauses.push('status=?'); values.push(status); }
    const sql = `SELECT * FROM evidence${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,id`;
    return this.db.prepare(sql).all(...values).map((row) => ({ id: row.id, projectId: row.project_id, taskId: row.task_id, kind: row.kind, status: row.status, payload: parse(row.payload_json, {}), receiptSha256: row.receipt_sha256, createdAt: row.created_at }));
  }


  createMessage({ id: messageId = id('message'), projectId, missionId = null, role, content, status = 'complete', metadata = {} }) {
    if (!this.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    if (missionId && !this.getMission(missionId)) throw new Error(`Unknown mission: ${missionId}`);
    const normalizedRole = required(role, 'message role');
    if (!['user', 'assistant', 'system', 'tool'].includes(normalizedRole)) throw new TypeError(`Unsupported message role: ${normalizedRole}`);
    const stamp = now();
    const record = { id: messageId, projectId, missionId, role: normalizedRole, content: required(content, 'message content'), status: String(status), createdAt: stamp, updatedAt: stamp, metadata: publicMetadata(metadata) };
    this.db.prepare('INSERT INTO conversation_messages(id,project_id,mission_id,role,content,status,created_at,updated_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(record.id, projectId, missionId, record.role, record.content, record.status, stamp, stamp, encode(record.metadata));
    return Object.freeze(record);
  }

  getMessage(messageId) {
    const row = this.db.prepare('SELECT * FROM conversation_messages WHERE id=?').get(messageId);
    return row ? this.#message(row) : null;
  }

  listMessages({ projectId = null, missionId = null, role = null, limit = 500 } = {}) {
    const clauses = []; const values = [];
    if (projectId) { clauses.push('project_id=?'); values.push(projectId); }
    if (missionId) { clauses.push('mission_id=?'); values.push(missionId); }
    if (role) { clauses.push('role=?'); values.push(role); }
    const safeLimit = Math.max(1, Math.min(5_000, Number(limit) || 500));
    const sql = `SELECT * FROM conversation_messages${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,rowid LIMIT ?`;
    return this.db.prepare(sql).all(...values, safeLimit).map((row) => this.#message(row));
  }

  updateMessage(messageId, changes = {}) {
    const current = this.getMessage(messageId);
    if (!current) throw new Error(`Unknown message: ${messageId}`);
    const next = { ...current, ...structuredClone(changes), id: current.id, projectId: current.projectId, missionId: current.missionId, role: current.role, createdAt: current.createdAt, updatedAt: now(), metadata: changes.metadata === undefined ? current.metadata : publicMetadata(changes.metadata) };
    this.db.prepare('UPDATE conversation_messages SET content=?,status=?,updated_at=?,metadata_json=? WHERE id=?')
      .run(required(next.content, 'message content'), String(next.status), next.updatedAt, encode(next.metadata), messageId);
    return Object.freeze(next);
  }

  #message(row) {
    return { id: row.id, projectId: row.project_id, missionId: row.mission_id, role: row.role, content: row.content, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, metadata: publicMetadata(parse(row.metadata_json, {})) };
  }

  createAutonomyGrant({ id: grantId = id('grant'), projectId, profile, scope = {}, actor = 'human:owner', status = 'active' }) {
    if (!this.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    const normalizedProfile = required(profile, 'autonomy profile');
    const stamp = now();
    return this.transaction(() => {
      if (status === 'active') this.db.prepare("UPDATE autonomy_grants SET status='revoked',updated_at=? WHERE project_id=? AND status='active'").run(stamp, projectId);
      const record = { id: grantId, projectId, profile: normalizedProfile, status: String(status), scope: publicMetadata(scope), actor: required(actor, 'autonomy actor'), createdAt: stamp, updatedAt: stamp };
      this.db.prepare('INSERT INTO autonomy_grants(id,project_id,profile,status,scope_json,actor,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(record.id, projectId, record.profile, record.status, encode(record.scope), record.actor, stamp, stamp);
      return Object.freeze(record);
    });
  }

  getAutonomyGrant(projectId) {
    const row = this.db.prepare("SELECT * FROM autonomy_grants WHERE project_id=? AND status='active' ORDER BY updated_at DESC,id DESC LIMIT 1").get(projectId);
    return row ? this.#autonomyGrant(row) : null;
  }

  listAutonomyGrants({ projectId = null, status = null } = {}) {
    const clauses = []; const values = [];
    if (projectId) { clauses.push('project_id=?'); values.push(projectId); }
    if (status) { clauses.push('status=?'); values.push(status); }
    const sql = `SELECT * FROM autonomy_grants${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at,id`;
    return this.db.prepare(sql).all(...values).map((row) => this.#autonomyGrant(row));
  }

  updateAutonomyGrant(grantId, changes = {}) {
    const row = this.db.prepare('SELECT * FROM autonomy_grants WHERE id=?').get(grantId);
    if (!row) throw new Error(`Unknown autonomy grant: ${grantId}`);
    const current = this.#autonomyGrant(row);
    const next = { ...current, ...structuredClone(changes), id: current.id, projectId: current.projectId, createdAt: current.createdAt, updatedAt: now(), scope: changes.scope === undefined ? current.scope : publicMetadata(changes.scope) };
    return this.transaction(() => {
      if (next.status === 'active') this.db.prepare("UPDATE autonomy_grants SET status='revoked',updated_at=? WHERE project_id=? AND status='active' AND id<>?").run(next.updatedAt, next.projectId, grantId);
      this.db.prepare('UPDATE autonomy_grants SET profile=?,status=?,scope_json=?,actor=?,updated_at=? WHERE id=?')
        .run(required(next.profile, 'autonomy profile'), String(next.status), encode(next.scope), required(next.actor, 'autonomy actor'), next.updatedAt, grantId);
      return Object.freeze(next);
    });
  }

  #autonomyGrant(row) {
    return { id: row.id, projectId: row.project_id, profile: row.profile, status: row.status, scope: publicMetadata(parse(row.scope_json, {})), actor: row.actor, createdAt: row.created_at, updatedAt: row.updated_at };
  }


  createGoal({ id: goalId = id('goal'), projectId, title, objective, status = 'active', successCriteria = [], budget = {}, schedule = { kind: 'manual' }, assumptions = [], activeMissionId = null, revision = 1, metadata = {} }) {
    if (!this.getProject(projectId)) throw new Error(`Unknown project: ${projectId}`);
    if (activeMissionId && !this.getMission(activeMissionId)) throw new Error(`Unknown mission: ${activeMissionId}`);
    const stamp = now();
    const record = { id: goalId, projectId, title: required(title, 'goal title'), objective: required(objective, 'goal objective'), status: String(status), successCriteria: structuredClone(successCriteria), budget: publicMetadata(structuredClone(budget)), schedule: publicMetadata(structuredClone(schedule)), assumptions: structuredClone(assumptions), activeMissionId, revision: Math.max(1, Number(revision) || 1), createdAt: stamp, updatedAt: stamp, metadata: publicMetadata(structuredClone(metadata)) };
    this.db.prepare(`INSERT INTO goals(id,project_id,title,objective,status,success_criteria_json,budget_json,schedule_json,assumptions_json,active_mission_id,revision,created_at,updated_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(record.id, record.projectId, record.title, record.objective, record.status, encode(record.successCriteria), encode(record.budget), encode(record.schedule), encode(record.assumptions), record.activeMissionId, record.revision, stamp, stamp, encode(record.metadata));
    return Object.freeze(record);
  }

  getGoal(goalId) {
    const row = this.db.prepare('SELECT * FROM goals WHERE id=?').get(String(goalId));
    return row ? this.#goal(row) : null;
  }

  listGoals({ projectId = null, status = null } = {}) {
    const clauses = []; const values = [];
    if (projectId) { clauses.push('project_id=?'); values.push(projectId); }
    if (status) { clauses.push('status=?'); values.push(status); }
    const sql = `SELECT * FROM goals${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC,id`;
    return this.db.prepare(sql).all(...values).map((row) => this.#goal(row));
  }

  updateGoal(goalId, changes = {}) {
    const current = this.getGoal(goalId);
    if (!current) throw new Error(`Unknown goal: ${goalId}`);
    if (changes.activeMissionId && !this.getMission(changes.activeMissionId)) throw new Error(`Unknown mission: ${changes.activeMissionId}`);
    const next = { ...current, ...structuredClone(changes), id: current.id, projectId: current.projectId, createdAt: current.createdAt, updatedAt: now(), revision: Math.max(current.revision, Number(changes.revision ?? current.revision) || current.revision), budget: changes.budget === undefined ? current.budget : publicMetadata(changes.budget), schedule: changes.schedule === undefined ? current.schedule : publicMetadata(changes.schedule), metadata: changes.metadata === undefined ? current.metadata : publicMetadata(changes.metadata) };
    this.db.prepare(`UPDATE goals SET title=?,objective=?,status=?,success_criteria_json=?,budget_json=?,schedule_json=?,assumptions_json=?,active_mission_id=?,revision=?,updated_at=?,metadata_json=? WHERE id=?`)
      .run(required(next.title, 'goal title'), required(next.objective, 'goal objective'), String(next.status), encode(next.successCriteria), encode(next.budget), encode(next.schedule), encode(next.assumptions), next.activeMissionId, next.revision, next.updatedAt, encode(next.metadata), goalId);
    return Object.freeze(next);
  }

  #goal(row) {
    return { id: row.id, projectId: row.project_id, title: row.title, objective: row.objective, status: row.status, successCriteria: parse(row.success_criteria_json, []), budget: publicMetadata(parse(row.budget_json, {})), schedule: publicMetadata(parse(row.schedule_json, {})), assumptions: parse(row.assumptions_json, []), activeMissionId: row.active_mission_id, revision: Number(row.revision), createdAt: row.created_at, updatedAt: row.updated_at, metadata: publicMetadata(parse(row.metadata_json, {})) };
  }

  attachGoalMission(goalId, missionId, { relation = 'supporting' } = {}) {
    if (!this.getGoal(goalId)) throw new Error(`Unknown goal: ${goalId}`);
    const mission = this.getMission(missionId);
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    const goal = this.getGoal(goalId);
    if (mission.projectId !== goal.projectId) throw new Error('Goal and mission must belong to the same project');
    const stamp = now();
    this.db.prepare(`INSERT INTO goal_missions(goal_id,mission_id,relation,created_at) VALUES(?,?,?,?) ON CONFLICT(goal_id,mission_id) DO UPDATE SET relation=excluded.relation`).run(goalId, missionId, required(relation, 'goal mission relation'), stamp);
    return Object.freeze({ goalId, missionId, relation, createdAt: stamp });
  }

  listGoalMissions(goalId) {
    return this.db.prepare('SELECT * FROM goal_missions WHERE goal_id=? ORDER BY created_at,mission_id').all(String(goalId)).map((row) => ({ goalId: row.goal_id, missionId: row.mission_id, relation: row.relation, createdAt: row.created_at }));
  }

  createGoalFact({ id: factId = id('fact'), goalId, claim, confidence = 0.5, impact = 'medium', status = 'observed', source = {}, receiptSha256 = null, invalidatesAssumptionIds = [] }) {
    if (!this.getGoal(goalId)) throw new Error(`Unknown goal: ${goalId}`);
    const stamp = now();
    const record = { id: factId, goalId, claim: required(claim, 'goal fact claim'), confidence: Math.max(0, Math.min(1, Number(confidence) || 0)), impact: String(impact), status: String(status), source: publicMetadata(structuredClone(source)), receiptSha256: receiptSha256 == null ? null : String(receiptSha256), invalidatesAssumptionIds: [...new Set(invalidatesAssumptionIds.map(String))], createdAt: stamp };
    this.db.prepare('INSERT INTO goal_facts(id,goal_id,claim,confidence,impact,status,source_json,receipt_sha256,invalidates_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(record.id, record.goalId, record.claim, record.confidence, record.impact, record.status, encode(record.source), record.receiptSha256, encode(record.invalidatesAssumptionIds), record.createdAt);
    return Object.freeze(record);
  }

  listGoalFacts(goalId) {
    return this.db.prepare('SELECT * FROM goal_facts WHERE goal_id=? ORDER BY created_at,id').all(String(goalId)).map((row) => ({ id: row.id, goalId: row.goal_id, claim: row.claim, confidence: Number(row.confidence), impact: row.impact, status: row.status, source: publicMetadata(parse(row.source_json, {})), receiptSha256: row.receipt_sha256, invalidatesAssumptionIds: parse(row.invalidates_json, []), createdAt: row.created_at }));
  }

  createGoalPlanRevision({ id: revisionId = id('planrev'), goalId, revision, summary, reason = '', plan = {} }) {
    if (!this.getGoal(goalId)) throw new Error(`Unknown goal: ${goalId}`);
    const stamp = now();
    const record = { id: revisionId, goalId, revision: Math.max(1, Number(revision) || 1), summary: required(summary, 'plan revision summary'), reason: String(reason ?? ''), plan: structuredClone(plan), createdAt: stamp };
    this.db.prepare('INSERT INTO goal_plan_revisions(id,goal_id,revision,summary,reason,plan_json,created_at) VALUES(?,?,?,?,?,?,?)').run(record.id, record.goalId, record.revision, record.summary, record.reason, encode(record.plan), record.createdAt);
    return Object.freeze(record);
  }

  listGoalPlanRevisions(goalId) {
    return this.db.prepare('SELECT * FROM goal_plan_revisions WHERE goal_id=? ORDER BY revision,id').all(String(goalId)).map((row) => ({ id: row.id, goalId: row.goal_id, revision: Number(row.revision), summary: row.summary, reason: row.reason, plan: parse(row.plan_json, {}), createdAt: row.created_at }));
  }

  createGoalPlanPatch({ id: patchId = id('planpatch'), goalId, baseRevision, status = 'proposed', reason, patch, idempotencyKey = null }) {
    if (!this.getGoal(goalId)) throw new Error(`Unknown goal: ${goalId}`);
    const stamp = now();
    const record = { id: patchId, goalId, baseRevision: Math.max(1, Number(baseRevision) || 1), status: String(status), reason: required(reason, 'plan patch reason'), patch: structuredClone(patch), idempotencyKey: idempotencyKey == null ? null : String(idempotencyKey), createdAt: stamp, appliedAt: null };
    this.db.prepare('INSERT INTO goal_plan_patches(id,goal_id,base_revision,status,reason,patch_json,idempotency_key,created_at,applied_at) VALUES(?,?,?,?,?,?,?,?,?)').run(record.id, record.goalId, record.baseRevision, record.status, record.reason, encode(record.patch), record.idempotencyKey, record.createdAt, null);
    return Object.freeze(record);
  }

  getGoalPlanPatch(patchId) {
    const row = this.db.prepare('SELECT * FROM goal_plan_patches WHERE id=?').get(String(patchId));
    return row ? { id: row.id, goalId: row.goal_id, baseRevision: Number(row.base_revision), status: row.status, reason: row.reason, patch: parse(row.patch_json, {}), idempotencyKey: row.idempotency_key, createdAt: row.created_at, appliedAt: row.applied_at } : null;
  }

  findGoalPlanPatchByKey(goalId, idempotencyKey) {
    if (!idempotencyKey) return null;
    const row = this.db.prepare('SELECT id FROM goal_plan_patches WHERE goal_id=? AND idempotency_key=?').get(String(goalId), String(idempotencyKey));
    return row ? this.getGoalPlanPatch(row.id) : null;
  }

  listGoalPlanPatches(goalId) {
    return this.db.prepare('SELECT id FROM goal_plan_patches WHERE goal_id=? ORDER BY created_at,id').all(String(goalId)).map((row) => this.getGoalPlanPatch(row.id));
  }

  updateGoalPlanPatch(patchId, changes = {}) {
    const current = this.getGoalPlanPatch(patchId);
    if (!current) throw new Error(`Unknown goal plan patch: ${patchId}`);
    const next = { ...current, ...structuredClone(changes), id: current.id, goalId: current.goalId, createdAt: current.createdAt };
    this.db.prepare('UPDATE goal_plan_patches SET status=?,reason=?,patch_json=?,applied_at=? WHERE id=?').run(String(next.status), required(next.reason, 'plan patch reason'), encode(next.patch), next.appliedAt, patchId);
    return Object.freeze(next);
  }


  getGoalScheduleState(goalId) {
    const row = this.db.prepare('SELECT * FROM goal_schedule_state WHERE goal_id=?').get(String(goalId));
    return row ? { goalId: row.goal_id, ...parse(row.state_json, {}), updatedAt: row.updated_at } : null;
  }

  upsertGoalScheduleState(goalId, changes = {}) {
    if (!this.getGoal(goalId)) throw new Error(`Unknown goal: ${goalId}`);
    const current = this.getGoalScheduleState(goalId) ?? { goalId, lastRunAt: null, lastRunId: null, nextRunAt: null, lastRepoFingerprint: null, pendingRepoFingerprint: null, pendingSince: null, running: false, runningSince: null, updatedAt: null };
    const updatedAt = now();
    const next = { ...current, ...structuredClone(changes), goalId, updatedAt };
    const state = { ...next }; delete state.goalId; delete state.updatedAt;
    this.db.prepare(`INSERT INTO goal_schedule_state(goal_id,state_json,updated_at) VALUES(?,?,?) ON CONFLICT(goal_id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at`).run(goalId, encode(state), updatedAt);
    return Object.freeze(next);
  }

  appendEvent(event) {
    this.db.prepare('INSERT INTO events(id,schema,time,type,refs_json,payload_json) VALUES(?,?,?,?,?,?)')
      .run(event.id, event.schema, event.time, event.type, encode(event.refs), encode(event.payload));
    const seq = Number(this.db.prepare('SELECT seq FROM events WHERE id=?').get(event.id).seq);
    const committed = Object.freeze({ ...event, seq });
    this.eventHub?.publish?.(committed);
    return committed;
  }

  listEvents({ afterSeq = 0, limit = 1_000 } = {}) {
    const safeLimit = Math.max(1, Math.min(100_000, Number(limit) || 1_000));
    return this.db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT ?').all(Number(afterSeq) || 0, safeLimit).map((row) => ({ seq: Number(row.seq), id: row.id, schema: row.schema, time: row.time, type: row.type, refs: parse(row.refs_json, {}), payload: parse(row.payload_json, {}) }));
  }
}
