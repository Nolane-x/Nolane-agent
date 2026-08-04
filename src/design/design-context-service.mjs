import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const SAFE_ATTRIBUTES = /^(?:id|class|role|name|type|title|alt|href|aria-[\w-]+|data-testid)$/i;
const SAFE_STYLES = new Set(['display', 'position', 'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'margin', 'padding', 'gap', 'width', 'height', 'border', 'borderRadius', 'opacity', 'alignItems', 'justifyContent', 'gridTemplateColumns', 'flexDirection']);

function required(value, label, max = 2_000) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); if (text.length > max) throw new Error(`${label} exceeds ${max} characters`); return text; }
function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function point(value) { return Object.freeze({ x: finite(value?.x), y: finite(value?.y) }); }
function rect(value) { return Object.freeze({ x: finite(value?.x), y: finite(value?.y), width: Math.max(0, finite(value?.width)), height: Math.max(0, finite(value?.height)) }); }

function sourceLocation(source) {
  if (!source) return null;
  const sourcePath = String(source.path ?? '').replaceAll('\\', '/');
  if (!sourcePath || path.posix.isAbsolute(sourcePath) || sourcePath.split('/').includes('..')) throw new TypeError('design source path must be workspace-relative');
  return Object.freeze({ path: sourcePath, line: Math.max(1, Math.trunc(finite(source.line, 1))), column: Math.max(1, Math.trunc(finite(source.column, 1))), component: source.component == null ? null : String(source.component).slice(0, 200) });
}

function sanitizeElement(element, secretValues) {
  if (!element || typeof element !== 'object') throw new TypeError('design element must be an object');
  const attributes = {};
  for (const [key, value] of Object.entries(element.attributes ?? {})) {
    if (!SAFE_ATTRIBUTES.test(key)) continue;
    attributes[key] = String(redactSecrets(String(value), { secretValues })).slice(0, 1_000);
  }
  const computedStyle = {};
  for (const [key, value] of Object.entries(element.computedStyle ?? {})) if (SAFE_STYLES.has(key)) computedStyle[key] = String(value).slice(0, 1_000);
  return Object.freeze({
    selector: required(element.selector, 'element selector', 1_000),
    tagName: required(element.tagName ?? 'div', 'element tagName', 100).toLowerCase(),
    text: String(redactSecrets(String(element.text ?? ''), { secretValues })).slice(0, 10_000),
    html: String(redactSecrets(String(element.html ?? ''), { secretValues })).replace(/\s(?:value|data-token|data-secret|data-password)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').slice(0, 50_000),
    attributes: Object.freeze(attributes),
    rect: rect(element.rect),
    computedStyle: Object.freeze(computedStyle),
    source: sourceLocation(element.source),
  });
}

export class DesignContextService {
  constructor({ file = ':memory:', artifactRoot, clock = Date.now, maxScreenshotBytes = 20_000_000 } = {}) {
    if (!artifactRoot) throw new TypeError('design artifactRoot is required');
    this.file = file === ':memory:' ? file : path.resolve(file); if (this.file !== ':memory:') mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    this.artifactRoot = path.resolve(artifactRoot); this.clock = clock; this.maxScreenshotBytes = Math.max(1_024, Number(maxScreenshotBytes) || 20_000_000);
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS design_contexts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,session_id TEXT NOT NULL,url TEXT NOT NULL,revision INTEGER NOT NULL,payload_json TEXT NOT NULL,context_sha256 TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS design_edits(id TEXT PRIMARY KEY,context_id TEXT NOT NULL,selector TEXT NOT NULL,instruction TEXT NOT NULL,concurrency_key TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS design_takeovers(lease_id TEXT PRIMARY KEY,session_id TEXT NOT NULL,actor TEXT NOT NULL,expires_at INTEGER NOT NULL,released_at INTEGER,lease_sha256 TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS design_takeovers_active ON design_takeovers(session_id,expires_at,released_at);
      CREATE TABLE IF NOT EXISTS design_revisions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,url TEXT NOT NULL,revision INTEGER NOT NULL,changed_files_json TEXT NOT NULL,created_at INTEGER NOT NULL);
    `);
  }

  async capture(input = {}, { secretValues = [] } = {}) {
    const elements = (input.elements ?? []).map((element) => sanitizeElement(element, secretValues));
    if (elements.length < 1 || elements.length > 100) throw new TypeError('design context requires between 1 and 100 elements');
    const selectors = new Set(elements.map((element) => element.selector));
    const relations = (input.relations ?? []).slice(0, 200).map((relation) => {
      const fromSelector = required(relation.fromSelector, 'relation fromSelector', 1_000); const toSelector = required(relation.toSelector, 'relation toSelector', 1_000);
      if (!selectors.has(fromSelector) || !selectors.has(toSelector)) throw new Error('design relation references an unselected element');
      return Object.freeze({ fromSelector, toSelector, kind: required(relation.kind, 'relation kind', 100) });
    });
    const annotations = (input.annotations ?? []).slice(0, 500).map((annotation) => Object.freeze({ kind: required(annotation.kind, 'annotation kind', 100), from: annotation.from ? point(annotation.from) : null, to: annotation.to ? point(annotation.to) : null, label: String(redactSecrets(String(annotation.label ?? ''), { secretValues })).slice(0, 2_000) }));
    const contextId = id('design'); const stamp = Math.trunc(this.clock()); let screenshot = null;
    if (input.screenshot !== undefined && input.screenshot !== null) {
      const bytes = Buffer.from(input.screenshot);
      if (bytes.length > this.maxScreenshotBytes) throw new Error('design screenshot exceeds size limit');
      const directory = path.join(this.artifactRoot, required(input.projectId, 'projectId', 200), required(input.sessionId, 'sessionId', 200)); await mkdir(directory, { recursive: true, mode: 0o700 });
      const digest = sha256(bytes); const filePath = path.join(directory, `${contextId}-${digest.slice(0, 16)}.png`); await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
      screenshot = Object.freeze({ filePath, bytes: bytes.length, sha256: digest });
    }
    const base = {
      schema: 'forge.design-context.v1', id: contextId, projectId: required(input.projectId, 'projectId', 200), sessionId: required(input.sessionId, 'sessionId', 200), url: required(input.url, 'design URL', 4_000), revision: Math.max(0, Math.trunc(finite(input.revision))), elements, relations, annotations,
      voiceTranscript: input.voiceTranscript == null ? null : String(redactSecrets(String(input.voiceTranscript), { secretValues })).slice(0, 20_000), screenshot, createdAt: stamp,
    };
    const contextSha256 = canonicalSha256(base); const record = Object.freeze({ ...base, contextSha256 });
    this.db.prepare('INSERT INTO design_contexts(id,project_id,session_id,url,revision,payload_json,context_sha256,created_at) VALUES(?,?,?,?,?,?,?,?)').run(record.id, record.projectId, record.sessionId, record.url, record.revision, JSON.stringify(record), contextSha256, stamp);
    return record;
  }

  get(contextId) { const row = this.db.prepare('SELECT payload_json FROM design_contexts WHERE id=?').get(String(contextId)); return row ? Object.freeze(JSON.parse(row.payload_json)) : null; }

  enqueueEdit(contextId, { selector, instruction } = {}) {
    const context = this.get(contextId); if (!context) throw new Error(`Unknown design context: ${contextId}`);
    const normalizedSelector = required(selector, 'edit selector', 1_000); if (!context.elements.some((element) => element.selector === normalizedSelector)) throw new Error('edit selector was not captured in design context');
    const edit = { id: id('design_edit'), contextId: context.id, selector: normalizedSelector, instruction: required(instruction, 'edit instruction', 10_000), concurrencyKey: canonicalSha256({ contextId: context.id, selector: normalizedSelector }).slice(0, 32), status: 'queued', createdAt: Math.trunc(this.clock()) };
    this.db.prepare('INSERT INTO design_edits(id,context_id,selector,instruction,concurrency_key,status,created_at) VALUES(?,?,?,?,?,?,?)').run(edit.id, edit.contextId, edit.selector, edit.instruction, edit.concurrencyKey, edit.status, edit.createdAt);
    return Object.freeze(edit);
  }

  listEdits(contextId) { return this.db.prepare('SELECT * FROM design_edits WHERE context_id=? ORDER BY created_at,id').all(String(contextId)).map((row) => Object.freeze({ id: row.id, contextId: row.context_id, selector: row.selector, instruction: row.instruction, concurrencyKey: row.concurrency_key, status: row.status, createdAt: Number(row.created_at) })); }

  requestTakeover({ sessionId, actor, ttlMs = 15 * 60_000 } = {}) {
    const ttl = Number(ttlMs); if (!Number.isInteger(ttl) || ttl < 1_000 || ttl > 24 * 60 * 60_000) throw new TypeError('takeover ttlMs must be between 1000 and 86400000');
    const stamp = Math.trunc(this.clock()); const leaseId = id('takeover'); const base = { schema: 'forge.design-takeover.v1', leaseId, sessionId: required(sessionId, 'sessionId', 200), actor: required(actor, 'takeover actor', 500), createdAt: stamp, expiresAt: stamp + ttl };
    const leaseSha256 = canonicalSha256(base); this.db.prepare('INSERT INTO design_takeovers(lease_id,session_id,actor,expires_at,released_at,lease_sha256,created_at) VALUES(?,?,?,?,NULL,?,?)').run(leaseId, base.sessionId, base.actor, base.expiresAt, leaseSha256, stamp);
    return Object.freeze({ ...base, leaseSha256 });
  }

  assertAgentControl(sessionId) {
    const stamp = Math.trunc(this.clock()); const active = this.db.prepare('SELECT * FROM design_takeovers WHERE session_id=? AND released_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1').get(String(sessionId), stamp);
    return Object.freeze(active ? { allowed: false, reason: 'human-takeover-active', leaseId: active.lease_id, actor: active.actor, expiresAt: Number(active.expires_at) } : { allowed: true, reason: 'agent-control' });
  }

  releaseTakeover(leaseId, { actor } = {}) {
    const row = this.db.prepare('SELECT * FROM design_takeovers WHERE lease_id=?').get(String(leaseId)); if (!row) throw new Error(`Unknown takeover lease: ${leaseId}`);
    if (row.actor !== String(actor)) throw new Error('Only the takeover lease owner can release control');
    if (row.released_at !== null) return Object.freeze({ leaseId: row.lease_id, released: true, releasedAt: Number(row.released_at) });
    const stamp = Math.trunc(this.clock()); this.db.prepare('UPDATE design_takeovers SET released_at=? WHERE lease_id=?').run(stamp, row.lease_id); return Object.freeze({ leaseId: row.lease_id, released: true, releasedAt: stamp });
  }

  recordHotReload({ sessionId, url, changedFiles = [], previousRevision = 0 } = {}) {
    const revision = Math.max(0, Math.trunc(finite(previousRevision))) + 1; const files = [...new Set(changedFiles.map((value) => String(value).replaceAll('\\', '/')).filter(Boolean))].slice(0, 1_000); const stamp = Math.trunc(this.clock());
    const record = { schema: 'forge.design-hot-reload.v1', id: id('reload'), sessionId: required(sessionId, 'sessionId', 200), url: required(url, 'reload URL', 4_000), revision, changedFiles: files, createdAt: stamp };
    this.db.prepare('INSERT INTO design_revisions(id,session_id,url,revision,changed_files_json,created_at) VALUES(?,?,?,?,?,?)').run(record.id, record.sessionId, record.url, revision, JSON.stringify(files), stamp); return Object.freeze({ ...record, revisionSha256: canonicalSha256(record) });
  }

  close() { this.db.close(); }
}
