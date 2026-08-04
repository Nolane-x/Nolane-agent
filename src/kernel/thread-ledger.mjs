import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createId, deepFreeze, nowIso, optional, parseJson, required, signed, uniqueStrings } from './kernel-utils.mjs';

const STATES = new Set(['running', 'paused', 'blocked', 'review', 'completed', 'failed', 'cancelled']);
const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const EVENT_LIMIT = 20_000;
const ARTIFACT_LIMIT = 50_000;

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > 250_000) throw new RangeError('thread metadata exceeds 250 KB');
  return deepFreeze(JSON.parse(serialized));
}

function rowToThread(row) {
  if (!row) return null;
  return deepFreeze({
    schema: 'nolane.sovereign-thread.v1', id: row.id, projectId: row.project_id, principalId: row.principal_id,
    title: row.title ?? 'Untitled thread', objective: row.objective, state: row.state, revision: Number(row.revision), epoch: row.epoch,
    labels: uniqueStrings(parseJson(row.labels_json, [])), metadata: normalizeMetadata(parseJson(row.metadata_json, {})),
    createdAt: row.created_at, updatedAt: row.updated_at, receiptSha256: row.receipt_sha256,
  });
}

function rowToEvent(row) {
  if (!row) return null;
  return deepFreeze({
    schema: 'nolane.sovereign-thread-event.v1', seq: Number(row.seq), id: row.id, threadId: row.thread_id,
    revision: Number(row.revision), epoch: row.epoch, type: row.type, actor: row.actor,
    payload: parseJson(row.payload_json, {}), createdAt: row.created_at, receiptSha256: row.receipt_sha256,
  });
}

export class SovereignThreadLedger {
  constructor({ file = ':memory:', clock = Date.now } = {}) {
    this.clock = clock;
    if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(String(file))), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sovereign_threads (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, principal_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT 'Untitled thread', objective TEXT NOT NULL,
        state TEXT NOT NULL, revision INTEGER NOT NULL, epoch TEXT NOT NULL, labels_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, receipt_sha256 TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sovereign_threads_project_idx ON sovereign_threads(project_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS sovereign_thread_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, thread_id TEXT NOT NULL REFERENCES sovereign_threads(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, epoch TEXT NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL,
        payload_json TEXT NOT NULL, created_at TEXT NOT NULL, receipt_sha256 TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sovereign_thread_events_thread_idx ON sovereign_thread_events(thread_id, seq);
      CREATE TABLE IF NOT EXISTS sovereign_thread_checkpoints (
        id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES sovereign_threads(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, epoch TEXT NOT NULL, label TEXT NOT NULL, snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL, receipt_sha256 TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sovereign_thread_checkpoints_thread_idx ON sovereign_thread_checkpoints(thread_id, revision DESC);
      CREATE TABLE IF NOT EXISTS sovereign_kernel_artifacts (
        id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES sovereign_threads(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, receipt_sha256 TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sovereign_kernel_artifacts_thread_idx ON sovereign_kernel_artifacts(thread_id, kind, updated_at DESC);
      CREATE INDEX IF NOT EXISTS sovereign_kernel_artifacts_project_idx ON sovereign_kernel_artifacts(project_id, kind, updated_at DESC);
    `);
    const threadColumns = new Set(this.db.prepare('PRAGMA table_info(sovereign_threads)').all().map((row) => row.name));
    if (!threadColumns.has('title')) this.db.exec("ALTER TABLE sovereign_threads ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled thread'");
  }

  createThread({ id = createId('thread'), projectId, principalId = 'local-user', title = null, objective, labels = [], metadata = {} } = {}) {
    const createdAt = nowIso(this.clock);
    const base = {
      schema: 'nolane.sovereign-thread.v1', id: required(id, 'thread id', 256), projectId: required(projectId, 'projectId', 256),
      principalId: required(principalId, 'principalId', 256), title: required(title ?? String(objective ?? '').slice(0, 120) ?? 'Untitled thread', 'title', 512), objective: required(objective, 'objective', 40_000),
      state: 'running', revision: 0, epoch: createId('epoch'), labels: uniqueStrings(labels, { maxItems: 64, maxLength: 128 }),
      metadata: normalizeMetadata(metadata), createdAt, updatedAt: createdAt,
    };
    const record = signed(base);
    const insert = this.db.prepare(`INSERT INTO sovereign_threads
      (id,project_id,principal_id,title,objective,state,revision,epoch,labels_json,metadata_json,created_at,updated_at,receipt_sha256)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    try {
      insert.run(record.id, record.projectId, record.principalId, record.title, record.objective, record.state, record.revision, record.epoch, JSON.stringify(record.labels), JSON.stringify(record.metadata), record.createdAt, record.updatedAt, record.receiptSha256);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) throw Object.assign(new Error(`thread already exists: ${record.id}`), { code: 'SOVEREIGN_THREAD_EXISTS' });
      throw error;
    }
    this.appendEvent({ threadId: record.id, type: 'thread.created', actor: record.principalId, payload: { objective: record.objective, labels: record.labels }, expectedRevision: 0, epoch: record.epoch });
    return this.getThread(record.id);
  }

  getThread(threadId) {
    const row = this.db.prepare('SELECT * FROM sovereign_threads WHERE id=?').get(required(threadId, 'threadId', 256));
    if (!row) throw Object.assign(new Error(`thread not found: ${threadId}`), { code: 'SOVEREIGN_THREAD_NOT_FOUND', statusCode: 404 });
    return rowToThread(row);
  }

  listThreads({ projectId = null, principalId = null, state = null, limit = 100 } = {}) {
    const bounded = Math.max(1, Math.min(1_000, Number(limit) || 100));
    const clauses = []; const params = [];
    if (projectId != null) { clauses.push('project_id=?'); params.push(String(projectId)); }
    if (principalId != null) { clauses.push('principal_id=?'); params.push(String(principalId)); }
    if (state != null) { if (!STATES.has(String(state))) throw new TypeError(`unsupported thread state: ${state}`); clauses.push('state=?'); params.push(String(state)); }
    const sql = `SELECT * FROM sovereign_threads${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT ?`;
    return deepFreeze(this.db.prepare(sql).all(...params, bounded).map(rowToThread));
  }

  appendEvent({ threadId, type, actor = 'kernel', payload = {}, expectedRevision = null, epoch = null, nextState = null } = {}) {
    const id = required(threadId, 'threadId', 256);
    const eventType = required(type, 'event type', 256);
    const eventActor = required(actor, 'actor', 256);
    const payloadText = JSON.stringify(payload ?? {});
    if (Buffer.byteLength(payloadText) > 1_000_000) throw new RangeError('event payload exceeds 1 MB');
    if (nextState != null && !STATES.has(String(nextState))) throw new TypeError(`unsupported thread state: ${nextState}`);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.getThread(id);
      if (TERMINAL_STATES.has(current.state) && eventType !== 'thread.resumed-from-checkpoint') throw Object.assign(new Error(`thread ${id} is terminal`), { code: 'SOVEREIGN_THREAD_TERMINAL' });
      if (expectedRevision != null && Number(expectedRevision) !== current.revision) throw Object.assign(new Error(`thread revision mismatch: expected ${expectedRevision}, actual ${current.revision}`), { code: 'SOVEREIGN_THREAD_REVISION_MISMATCH', statusCode: 409 });
      if (epoch != null && String(epoch) !== current.epoch) throw Object.assign(new Error('thread epoch is stale'), { code: 'SOVEREIGN_THREAD_EPOCH_STALE', statusCode: 409 });
      const revision = current.revision + 1;
      const createdAt = nowIso(this.clock);
      const base = { schema: 'nolane.sovereign-thread-event.v1', id: createId('event'), threadId: id, revision, epoch: current.epoch, type: eventType, actor: eventActor, payload: JSON.parse(payloadText), createdAt };
      const event = signed(base);
      this.db.prepare(`INSERT INTO sovereign_thread_events (id,thread_id,revision,epoch,type,actor,payload_json,created_at,receipt_sha256) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(event.id, event.threadId, event.revision, event.epoch, event.type, event.actor, JSON.stringify(event.payload), event.createdAt, event.receiptSha256);
      const state = nextState == null ? current.state : String(nextState);
      const threadBase = { ...current, state, revision, updatedAt: createdAt };
      delete threadBase.receiptSha256;
      const updated = signed(threadBase);
      this.db.prepare('UPDATE sovereign_threads SET state=?,revision=?,updated_at=?,receipt_sha256=? WHERE id=?').run(updated.state, updated.revision, updated.updatedAt, updated.receiptSha256, id);
      this.db.exec('COMMIT');
      return event;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  transition(threadId, state, { actor = 'kernel', reason = null, expectedRevision = null, epoch = null } = {}) {
    const target = String(state);
    if (!STATES.has(target)) throw new TypeError(`unsupported thread state: ${state}`);
    const current = this.getThread(threadId);
    if (current.state === target) return signed({ schema: 'nolane.sovereign-thread-transition.v1', threadId: current.id, from: current.state, to: target, changed: false, revision: current.revision, epoch: current.epoch, at: nowIso(this.clock) });
    const allowed = {
      running: new Set(['paused', 'blocked', 'review', 'completed', 'failed', 'cancelled']),
      paused: new Set(['running', 'cancelled']), blocked: new Set(['running', 'failed', 'cancelled']),
      review: new Set(['running', 'completed', 'failed', 'cancelled']), completed: new Set(), failed: new Set(), cancelled: new Set(),
    };
    if (!allowed[current.state]?.has(target)) throw Object.assign(new Error(`invalid thread transition ${current.state} -> ${target}`), { code: 'SOVEREIGN_THREAD_TRANSITION_INVALID' });
    const event = this.appendEvent({ threadId: current.id, type: `thread.${target}`, actor, payload: { from: current.state, to: target, reason: optional(reason, 4_000) }, expectedRevision, epoch, nextState: target });
    return signed({ schema: 'nolane.sovereign-thread-transition.v1', threadId: current.id, from: current.state, to: target, changed: true, revision: event.revision, epoch: event.epoch, eventReceiptSha256: event.receiptSha256, at: event.createdAt });
  }

  timeline(threadId, { afterSeq = 0, limit = 500 } = {}) {
    const bounded = Math.max(1, Math.min(EVENT_LIMIT, Number(limit) || 500));
    this.getThread(threadId);
    return deepFreeze(this.db.prepare('SELECT * FROM sovereign_thread_events WHERE thread_id=? AND seq>? ORDER BY seq ASC LIMIT ?').all(String(threadId), Number(afterSeq) || 0, bounded).map(rowToEvent));
  }

  checkpoint(threadId, { label = 'Checkpoint', actor = 'kernel', snapshot = {}, expectedRevision = null, epoch = null } = {}) {
    const current = this.getThread(threadId);
    if (expectedRevision != null && Number(expectedRevision) !== current.revision) throw Object.assign(new Error('checkpoint revision mismatch'), { code: 'SOVEREIGN_THREAD_REVISION_MISMATCH', statusCode: 409 });
    if (epoch != null && String(epoch) !== current.epoch) throw Object.assign(new Error('checkpoint epoch is stale'), { code: 'SOVEREIGN_THREAD_EPOCH_STALE', statusCode: 409 });
    const checkpointId = createId('checkpoint');
    const createdAt = nowIso(this.clock);
    const safeSnapshot = JSON.parse(JSON.stringify(snapshot ?? {}));
    if (Buffer.byteLength(JSON.stringify(safeSnapshot)) > 2_000_000) throw new RangeError('checkpoint snapshot exceeds 2 MB');
    const base = { schema: 'nolane.sovereign-thread-checkpoint.v1', id: checkpointId, threadId: current.id, revision: current.revision, epoch: current.epoch, label: required(label, 'checkpoint label', 512), snapshot: safeSnapshot, createdAt };
    const checkpoint = signed(base);
    this.db.prepare('INSERT INTO sovereign_thread_checkpoints (id,thread_id,revision,epoch,label,snapshot_json,created_at,receipt_sha256) VALUES (?,?,?,?,?,?,?,?)')
      .run(checkpoint.id, checkpoint.threadId, checkpoint.revision, checkpoint.epoch, checkpoint.label, JSON.stringify(checkpoint.snapshot), checkpoint.createdAt, checkpoint.receiptSha256);
    this.appendEvent({ threadId: current.id, type: 'thread.checkpointed', actor, payload: { checkpointId, label: checkpoint.label, checkpointReceiptSha256: checkpoint.receiptSha256 }, expectedRevision: current.revision, epoch: current.epoch });
    return checkpoint;
  }

  getCheckpoint(checkpointId) {
    const row = this.db.prepare('SELECT * FROM sovereign_thread_checkpoints WHERE id=?').get(required(checkpointId, 'checkpointId', 256));
    if (!row) throw Object.assign(new Error(`checkpoint not found: ${checkpointId}`), { code: 'SOVEREIGN_CHECKPOINT_NOT_FOUND', statusCode: 404 });
    return deepFreeze({ schema: 'nolane.sovereign-thread-checkpoint.v1', id: row.id, threadId: row.thread_id, revision: Number(row.revision), epoch: row.epoch, label: row.label, snapshot: parseJson(row.snapshot_json, {}), createdAt: row.created_at, receiptSha256: row.receipt_sha256 });
  }

  resumeFromCheckpoint(checkpointId, { actor = 'kernel', reason = 'resume' } = {}) {
    const checkpoint = this.getCheckpoint(checkpointId);
    const current = this.getThread(checkpoint.threadId);
    const newEpoch = createId('epoch');
    const createdAt = nowIso(this.clock);
    const revision = current.revision + 1;
    const eventBase = { schema: 'nolane.sovereign-thread-event.v1', id: createId('event'), threadId: current.id, revision, epoch: newEpoch, type: 'thread.resumed-from-checkpoint', actor: required(actor, 'actor', 256), payload: { checkpointId: checkpoint.id, checkpointRevision: checkpoint.revision, reason: optional(reason, 4_000) }, createdAt };
    const event = signed(eventBase);
    const threadBase = { ...current, state: 'running', revision, epoch: newEpoch, updatedAt: createdAt, metadata: { ...current.metadata, resumedFromCheckpointId: checkpoint.id } };
    delete threadBase.receiptSha256;
    const updated = signed(threadBase);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`INSERT INTO sovereign_thread_events (id,thread_id,revision,epoch,type,actor,payload_json,created_at,receipt_sha256) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(event.id, event.threadId, event.revision, event.epoch, event.type, event.actor, JSON.stringify(event.payload), event.createdAt, event.receiptSha256);
      this.db.prepare('UPDATE sovereign_threads SET state=?,revision=?,epoch=?,metadata_json=?,updated_at=?,receipt_sha256=? WHERE id=?')
        .run(updated.state, updated.revision, updated.epoch, JSON.stringify(updated.metadata), updated.updatedAt, updated.receiptSha256, updated.id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return deepFreeze({ thread: this.getThread(current.id), checkpoint, event });
  }

  putArtifact({ id, threadId, projectId = null, kind, payload } = {}) {
    const thread = this.getThread(threadId);
    const artifactId = required(id, 'artifact id', 256);
    const artifactKind = required(kind, 'artifact kind', 128);
    const artifactProjectId = required(projectId ?? thread.projectId, 'projectId', 256);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('artifact payload must be an object');
    const payloadText = JSON.stringify(payload);
    if (Buffer.byteLength(payloadText) > 5_000_000) throw new RangeError('artifact payload exceeds 5 MB');
    const timestamp = nowIso(this.clock);
    const payloadSha256 = signed({ schema: 'nolane.sovereign-kernel-payload-digest.v1', payload }).receiptSha256;
    const base = { schema: 'nolane.sovereign-kernel-artifact.v1', id: artifactId, threadId: thread.id, projectId: artifactProjectId, kind: artifactKind, payloadSha256, createdAt: timestamp, updatedAt: timestamp };
    const previous = this.db.prepare('SELECT created_at FROM sovereign_kernel_artifacts WHERE id=?').get(artifactId);
    if (previous) base.createdAt = previous.created_at;
    const record = signed(base);
    this.db.prepare(`INSERT INTO sovereign_kernel_artifacts
      (id,thread_id,project_id,kind,payload_json,payload_sha256,created_at,updated_at,receipt_sha256)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET thread_id=excluded.thread_id,project_id=excluded.project_id,kind=excluded.kind,
      payload_json=excluded.payload_json,payload_sha256=excluded.payload_sha256,updated_at=excluded.updated_at,receipt_sha256=excluded.receipt_sha256`)
      .run(record.id, record.threadId, record.projectId, record.kind, payloadText, record.payloadSha256, record.createdAt, record.updatedAt, record.receiptSha256);
    return deepFreeze({ ...record, payload: deepFreeze(JSON.parse(payloadText)) });
  }

  getArtifact(artifactId) {
    const row = this.db.prepare('SELECT * FROM sovereign_kernel_artifacts WHERE id=?').get(required(artifactId, 'artifactId', 256));
    if (!row) throw Object.assign(new Error(`kernel artifact not found: ${artifactId}`), { code: 'SOVEREIGN_KERNEL_ARTIFACT_NOT_FOUND', statusCode: 404 });
    return deepFreeze({ schema: 'nolane.sovereign-kernel-artifact.v1', id: row.id, threadId: row.thread_id, projectId: row.project_id, kind: row.kind, payload: parseJson(row.payload_json, {}), payloadSha256: row.payload_sha256, createdAt: row.created_at, updatedAt: row.updated_at, receiptSha256: row.receipt_sha256 });
  }

  listArtifacts({ threadId = null, projectId = null, kind = null, limit = 5_000 } = {}) {
    const bounded = Math.max(1, Math.min(ARTIFACT_LIMIT, Number(limit) || 5_000));
    const clauses = []; const params = [];
    if (threadId != null) { clauses.push('thread_id=?'); params.push(String(threadId)); }
    if (projectId != null) { clauses.push('project_id=?'); params.push(String(projectId)); }
    if (kind != null) { clauses.push('kind=?'); params.push(String(kind)); }
    const rows = this.db.prepare(`SELECT * FROM sovereign_kernel_artifacts${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT ?`).all(...params, bounded);
    return deepFreeze(rows.map((row) => ({ schema: 'nolane.sovereign-kernel-artifact.v1', id: row.id, threadId: row.thread_id, projectId: row.project_id, kind: row.kind, payload: parseJson(row.payload_json, {}), payloadSha256: row.payload_sha256, createdAt: row.created_at, updatedAt: row.updated_at, receiptSha256: row.receipt_sha256 })));
  }

  snapshot(threadId) {
    const thread = this.getThread(threadId);
    const events = this.timeline(thread.id, { limit: 2_000 });
    const checkpoints = this.db.prepare('SELECT * FROM sovereign_thread_checkpoints WHERE thread_id=? ORDER BY revision DESC LIMIT 100').all(thread.id).map((row) => ({ id: row.id, revision: Number(row.revision), epoch: row.epoch, label: row.label, createdAt: row.created_at, receiptSha256: row.receipt_sha256 }));
    return signed({ schema: 'nolane.sovereign-thread-snapshot.v1', thread, events, checkpoints: deepFreeze(checkpoints), generatedAt: nowIso(this.clock) });
  }

  close() { this.db.close(); }
}
