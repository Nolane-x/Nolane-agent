import { createHash, randomUUID } from 'node:crypto';
import { mkdir, appendFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { redactSecrets } from '../security/redaction.mjs';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
const encode = (value) => JSON.stringify(value ?? null);
const parse = (value, fallback) => value == null ? fallback : JSON.parse(value);

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function optional(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function bounded(value, fallback, min, max, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

function publicMetadata(value, secretValues = []) {
  const blocked = /(?:secret|private|password|credential|api[_-]?key|access[_-]?token|refresh[_-]?token|chain[_-]?of[_-]?thought|reasoning)/i;
  const walk = (input) => {
    if (Array.isArray(input)) return input.map(walk);
    if (!input || typeof input !== 'object') return input;
    const out = {};
    for (const [key, child] of Object.entries(input)) {
      if (blocked.test(key)) continue;
      out[key] = walk(child);
    }
    return out;
  };
  return redactSecrets(walk(value && typeof value === 'object' ? value : {}), { secretValues });
}

function publicArtifact(record) {
  return Object.freeze({
    schema: record.schema,
    id: record.id,
    kind: record.kind,
    bytes: record.bytes,
    sha256: record.sha256,
    preview: record.preview,
    createdAt: record.createdAt,
    refs: structuredClone(record.refs ?? {}),
    metadata: structuredClone(record.metadata ?? {}),
  });
}

function visibleConversationMessage(message, secretValues) {
  const role = String(message?.role ?? '');
  const metadata = message?.metadata && typeof message.metadata === 'object' ? message.metadata : {};
  if (!['user', 'assistant', 'tool', 'system'].includes(role)) return null;
  if (metadata.privateReasoning === true || metadata.hiddenReasoning === true || metadata.chainOfThought === true || metadata.hidden === true) return null;
  if (role === 'system' && metadata.userVisible !== true && metadata.visible !== true) return null;
  const content = String(message?.content ?? '');
  if (!content) return null;
  const normalized = {
    schema: 'forge.context-history-message.v1',
    id: optional(message.id),
    role,
    content,
    status: optional(message.status) ?? 'complete',
    createdAt: optional(message.createdAt),
    updatedAt: optional(message.updatedAt),
    metadata: publicMetadata(metadata, secretValues),
  };
  normalized.itemKey = normalized.id ? `message:${normalized.id}` : `message:${canonicalSha256(normalized)}`;
  return normalized;
}

function terminalEntry(entry, secretValues) {
  const normalized = {
    schema: 'forge.context-history-terminal-entry.v1',
    id: optional(entry?.id),
    command: optional(entry?.command),
    args: Array.isArray(entry?.args) ? entry.args.map(String).slice(0, 256) : [],
    cwd: optional(entry?.cwd),
    startedAt: optional(entry?.startedAt),
    endedAt: optional(entry?.endedAt),
    exitCode: Number.isInteger(entry?.exitCode) ? entry.exitCode : null,
    signal: optional(entry?.signal),
    stdout: String(entry?.stdout ?? ''),
    stderr: String(entry?.stderr ?? ''),
    stdoutArtifactId: optional(entry?.stdoutArtifactId),
    stderrArtifactId: optional(entry?.stderrArtifactId),
    metadata: publicMetadata(entry?.metadata, secretValues),
  };
  normalized.itemKey = normalized.id ? `terminal:${normalized.id}` : `terminal:${canonicalSha256(normalized)}`;
  return normalized;
}

function rowRecord(row) {
  const missionId = row.mission_id || null;
  const sessionId = row.session_id || null;
  return Object.freeze({
    schema: 'forge.context-history-archive.v1',
    id: row.id,
    projectId: row.project_id,
    missionId,
    sessionId,
    kind: row.kind,
    artifact: Object.freeze(parse(row.artifact_json, {})),
    sourceSha256: row.source_sha256,
    itemCount: row.item_count,
    firstItemKey: row.first_item_key,
    lastItemKey: row.last_item_key,
    createdAt: row.created_at,
    metadata: Object.freeze(parse(row.metadata_json, {})),
    receiptSha256: row.receipt_sha256,
  });
}

export class ContextHistoryArchive {
  constructor({ file, contextStore, clock = now, conversationLoader = null } = {}) {
    if (!file) throw new TypeError('ContextHistoryArchive file is required');
    if (!contextStore?.artifactize || !contextStore?.read || !contextStore?.search) throw new TypeError('ContextHistoryArchive contextStore is required');
    this.file = path.resolve(file);
    this.contextStore = contextStore;
    this.clock = clock;
    this.conversationLoader = conversationLoader;
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS context_history_archives(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        artifact_id TEXT NOT NULL UNIQUE,
        artifact_json TEXT NOT NULL,
        source_sha256 TEXT NOT NULL,
        item_count INTEGER NOT NULL,
        first_item_key TEXT,
        last_item_key TEXT,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS context_history_scope_time ON context_history_archives(project_id,mission_id,session_id,kind,created_at,id);
      CREATE TABLE IF NOT EXISTS context_history_items(
        project_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        item_key TEXT NOT NULL,
        archive_id TEXT NOT NULL REFERENCES context_history_archives(id) ON DELETE CASCADE,
        PRIMARY KEY(project_id,mission_id,session_id,kind,item_key)
      );
    `);
  }

  async archiveConversation({ projectId, missionId = null, sessionId = null, messages = null, secretValues = [] } = {}) {
    const project = required(projectId, 'projectId');
    const mission = optional(missionId);
    const session = optional(sessionId) ?? mission ?? 'conversation';
    const source = messages ?? (this.conversationLoader ? await this.conversationLoader({ projectId: project, missionId: mission }) : []);
    if (!Array.isArray(source)) throw new TypeError('messages must be an array');
    const items = source.map((message) => visibleConversationMessage(message, secretValues)).filter(Boolean)
      .sort((a, b) => `${a.createdAt ?? ''}\0${a.id ?? a.itemKey}`.localeCompare(`${b.createdAt ?? ''}\0${b.id ?? b.itemKey}`));
    return this.#archiveBatch({ projectId: project, missionId: mission, sessionId: session, kind: 'conversation', items, secretValues });
  }

  async archiveTerminal({ projectId, missionId = null, sessionId, entries = [], secretValues = [] } = {}) {
    const project = required(projectId, 'projectId');
    const session = required(sessionId, 'sessionId');
    if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
    const items = entries.map((entry) => terminalEntry(entry, secretValues));
    return this.#archiveBatch({ projectId: project, missionId: optional(missionId), sessionId: session, kind: 'terminal', items, secretValues });
  }

  async compactConversation({ projectId, missionId = null, sessionId = null, messages = null, summary, secretValues = [] } = {}) {
    const text = required(summary, 'summary');
    await this.archiveConversation({ projectId, missionId, sessionId, messages, secretValues });
    const originals = this.list({ projectId, missionId, sessionId: sessionId ?? missionId ?? 'conversation', kind: 'conversation', limit: 5_000 });
    const originalArtifactIds = originals.map((record) => record.artifact.id);
    const item = {
      schema: 'forge.context-history-summary.v1',
      itemKey: `summary:${canonicalSha256({ text, originalArtifactIds })}`,
      summary: text,
      originalArtifactIds,
      createdAt: this.clock(),
    };
    const result = await this.#archiveBatch({
      projectId: required(projectId, 'projectId'),
      missionId: optional(missionId),
      sessionId: optional(sessionId) ?? optional(missionId) ?? 'conversation',
      kind: 'conversation-summary',
      items: [item],
      secretValues,
      metadata: { originalArtifactIds },
    });
    return Object.freeze({ schema: 'forge.context-history-compaction.v1', originals, summary: result, receiptSha256: canonicalSha256({ originals: originals.map((record) => record.receiptSha256), summary: result.receiptSha256 }) });
  }

  list({ projectId, missionId = undefined, sessionId = undefined, kind = null, limit = 100 } = {}) {
    const clauses = ['project_id=?']; const values = [required(projectId, 'projectId')];
    if (missionId !== undefined) { clauses.push('mission_id=?'); values.push(optional(missionId) ?? ''); }
    if (sessionId !== undefined) { clauses.push('session_id=?'); values.push(optional(sessionId) ?? ''); }
    if (kind) { clauses.push('kind=?'); values.push(required(kind, 'kind')); }
    const max = bounded(limit, 100, 1, 5_000, 'limit');
    return Object.freeze(this.db.prepare(`SELECT * FROM context_history_archives WHERE ${clauses.join(' AND ')} ORDER BY created_at,id LIMIT ?`).all(...values, max).map(rowRecord));
  }

  async get(archiveId, { projectId } = {}) {
    const row = this.db.prepare('SELECT * FROM context_history_archives WHERE id=?').get(required(archiveId, 'archiveId'));
    if (!row) throw Object.assign(new Error('Context history archive not found'), { statusCode: 404, code: 'CONTEXT_HISTORY_NOT_FOUND' });
    if (projectId && row.project_id !== String(projectId)) throw Object.assign(new Error('Context history scope denied'), { statusCode: 403, code: 'CONTEXT_HISTORY_SCOPE_DENIED' });
    return rowRecord(row);
  }

  async search({ projectId, missionId = undefined, sessionId = undefined, kind = null, query, limit = 100, regex = false, caseSensitive = false } = {}) {
    const max = bounded(limit, 100, 1, 1_000, 'limit');
    const archives = this.list({ projectId, missionId, sessionId, kind, limit: 5_000 });
    const items = [];
    for (const archive of archives) {
      if (items.length >= max) break;
      const result = await this.contextStore.search(archive.artifact.id, required(query, 'query'), { limit: max - items.length, regex, caseSensitive });
      for (const match of result.items) items.push(Object.freeze({ archiveId: archive.id, artifactId: archive.artifact.id, kind: archive.kind, ...match }));
    }
    return Object.freeze({ schema: 'forge.context-history-search.v1', projectId: String(projectId), query: String(query), items: Object.freeze(items), truncated: items.length >= max });
  }

  async #archiveBatch({ projectId, missionId, sessionId, kind, items, secretValues, metadata = {} }) {
    const missionScope = missionId ?? '';
    const sessionScope = sessionId ?? '';
    const exists = this.db.prepare('SELECT 1 FROM context_history_items WHERE project_id=? AND mission_id=? AND session_id=? AND kind=? AND item_key=?');
    const unseen = items.filter((item) => !exists.get(projectId, missionScope, sessionScope, kind, required(item.itemKey, 'itemKey')));
    if (!unseen.length) {
      return Object.freeze({ schema: 'forge.context-history-archive-result.v1', created: false, projectId, missionId, sessionId, kind, itemCount: 0, archives: this.list({ projectId, missionId, sessionId, kind, limit: 5_000 }) });
    }
    const serializable = unseen.map(({ itemKey, ...item }) => redactSecrets(item, { secretValues }));
    const content = `${serializable.map((item) => JSON.stringify(item)).join('\n')}\n`;
    const sourceSha256 = createHash('sha256').update(content).digest('hex');
    const artifactRecord = await this.contextStore.artifactize({
      kind: `history-${kind}`,
      content,
      metadata: { schema: 'forge.context-history-artifact-metadata.v1', historyKind: kind, itemCount: unseen.length, ...publicMetadata(metadata, secretValues) },
    }, {
      projectId,
      taskId: missionId ?? sessionId ?? 'history',
      runId: sessionId ?? missionId ?? kind,
      refs: { projectId, missionId, sessionId, historyKind: kind },
      secretValues,
    });
    const artifact = publicArtifact(artifactRecord);
    const archiveId = id('history');
    const createdAt = this.clock();
    const base = {
      schema: 'forge.context-history-receipt.v1', archiveId, projectId, missionId, sessionId, kind,
      artifactId: artifact.id, artifactSha256: artifact.sha256, sourceSha256, itemCount: unseen.length,
      firstItemKey: unseen[0].itemKey, lastItemKey: unseen.at(-1).itemKey, createdAt,
    };
    const receiptSha256 = canonicalSha256(base);
    const safeMetadata = publicMetadata(metadata, secretValues);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO context_history_archives(id,project_id,mission_id,session_id,kind,artifact_id,artifact_json,source_sha256,item_count,first_item_key,last_item_key,created_at,metadata_json,receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(archiveId, projectId, missionScope, sessionScope, kind, artifact.id, encode(artifact), sourceSha256, unseen.length, unseen[0].itemKey, unseen.at(-1).itemKey, createdAt, encode(safeMetadata), receiptSha256);
      const insertItem = this.db.prepare('INSERT INTO context_history_items(project_id,mission_id,session_id,kind,item_key,archive_id) VALUES(?,?,?,?,?,?)');
      for (const item of unseen) insertItem.run(projectId, missionScope, sessionScope, kind, item.itemKey, archiveId);
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
    return Object.freeze({ schema: 'forge.context-history-archive-result.v1', created: true, id: archiveId, projectId, missionId, sessionId, kind, artifact, sourceSha256, itemCount: unseen.length, firstItemKey: unseen[0].itemKey, lastItemKey: unseen.at(-1).itemKey, createdAt, metadata: Object.freeze(safeMetadata), receiptSha256 });
  }

  close() { this.db.close(); }
}

export class TerminalHistoryRecorder {
  constructor({ terminalManager, archive, root, secretValuesProvider = () => [] } = {}) {
    if (!terminalManager?.on || !terminalManager?.off) throw new TypeError('TerminalHistoryRecorder terminalManager is required');
    if (!archive?.archiveTerminal) throw new TypeError('TerminalHistoryRecorder archive is required');
    if (!root) throw new TypeError('TerminalHistoryRecorder root is required');
    this.terminalManager = terminalManager;
    this.archive = archive;
    this.root = path.resolve(root);
    this.secretValuesProvider = secretValuesProvider;
    this.sessions = new Map();
    this.pending = new Set();
    this.started = false;
    this.listeners = {
      created: (event) => this.#created(event),
      output: (event) => this.#output(event),
      exit: (event) => this.#exit(event),
      'session-error': (event) => this.#sessionError(event),
    };
  }

  start() {
    if (this.started) return this;
    this.started = true;
    for (const [name, listener] of Object.entries(this.listeners)) this.terminalManager.on(name, listener);
    return this;
  }

  #track(promise) {
    const tracked = Promise.resolve(promise).finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
    return tracked;
  }

  #created(event) {
    const sessionId = String(event?.id ?? event?.sessionId ?? '');
    const projectId = String(event?.projectId ?? '');
    if (!sessionId || !projectId) return;
    const file = path.join(this.root, `${createHash('sha256').update(`${projectId}\0${sessionId}`).digest('hex')}.log`);
    const state = { projectId, missionId: optional(event.missionId), sessionId, file, command: optional(event.shell), args: Array.isArray(event.args) ? event.args.map(String) : [], cwd: optional(event.cwd), startedAt: event.createdAt ?? now(), endedAt: null, exitCode: null, signal: null, stderr: '', writeChain: null };
    state.writeChain = mkdir(this.root, { recursive: true, mode: 0o700 }).then(() => appendFile(file, '', { mode: 0o600 }));
    this.sessions.set(sessionId, state);
  }

  #output(event) {
    const state = this.sessions.get(String(event?.sessionId ?? ''));
    if (!state) return;
    state.writeChain = state.writeChain.then(() => appendFile(state.file, String(event?.data ?? ''), { encoding: 'utf8', mode: 0o600 }));
  }

  #sessionError(event) {
    const state = this.sessions.get(String(event?.sessionId ?? ''));
    if (!state) return;
    state.stderr += `${String(event?.message ?? event?.error ?? 'terminal session error')}\n`;
  }

  #exit(event) {
    const state = this.sessions.get(String(event?.sessionId ?? ''));
    if (!state) return;
    state.endedAt = event?.endedAt ?? now();
    state.exitCode = Number.isInteger(event?.exitCode) ? event.exitCode : null;
    state.signal = optional(event?.signal);
    this.#track(this.#finalize(state));
  }

  async #finalize(state) {
    // Wait only for this session's ordered output writes; waiting for the global
    // pending set would include this finalize promise and deadlock.
    await state.writeChain;
    const stdout = await readFile(state.file, 'utf8').catch(() => '');
    const secretValues = await this.secretValuesProvider({ projectId: state.projectId, sessionId: state.sessionId });
    try {
      await this.archive.archiveTerminal({
        projectId: state.projectId,
        missionId: state.missionId,
        sessionId: state.sessionId,
        secretValues: Array.isArray(secretValues) ? secretValues : [],
        entries: [{ id: state.sessionId, command: state.command, args: state.args, cwd: state.cwd, startedAt: state.startedAt, endedAt: state.endedAt, exitCode: state.exitCode, signal: state.signal, stdout, stderr: state.stderr }],
      });
    } finally {
      this.sessions.delete(state.sessionId);
      await rm(state.file, { force: true });
    }
  }

  async flush() {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  async close() {
    if (this.started) {
      for (const [name, listener] of Object.entries(this.listeners)) this.terminalManager.off(name, listener);
      this.started = false;
    }
    for (const state of [...this.sessions.values()]) {
      state.endedAt ??= now();
      this.#track(this.#finalize(state));
    }
    await this.flush();
    await rm(this.root, { recursive: true, force: true });
  }
}
