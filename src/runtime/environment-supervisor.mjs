import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const isoNow = () => new Date().toISOString();
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

function integer(value, fallback, min, max, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

function safeArgs(value, label = 'args') {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new TypeError(`${label} must be an array of strings`);
  if (value.length > 256) throw new TypeError(`${label} exceeds 256 items`);
  return value.map((item) => item.slice(0, 16_384));
}

function safeEnv(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('env must be an object');
  const entries = Object.entries(value);
  if (entries.length > 128) throw new TypeError('env exceeds 128 entries');
  const out = {};
  for (const [key, item] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new TypeError(`Invalid environment variable name: ${key}`);
    if (typeof item !== 'string') throw new TypeError(`Environment variable ${key} must be a string`);
    out[key] = item;
  }
  return out;
}

function safeRelative(root, candidate) {
  const absolute = path.resolve(root, String(candidate));
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Manifest path escapes environment cwd: ${candidate}`);
  return { absolute, relative: relative.replaceAll(path.sep, '/') || '.' };
}

function normalizeHealth(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('health must be an object');
  const kind = String(value.kind ?? 'http');
  if (kind !== 'http') throw new TypeError(`Unsupported health kind: ${kind}`);
  const url = new URL(required(value.url, 'health.url'));
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('health.url must use HTTP or HTTPS');
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) && url.protocol !== 'https:') throw new TypeError('non-loopback health endpoints require HTTPS');
  const expectedStatuses = Array.isArray(value.expectedStatuses) && value.expectedStatuses.length
    ? [...new Set(value.expectedStatuses.map(Number).filter((status) => Number.isInteger(status) && status >= 100 && status <= 599))]
    : [200];
  if (!expectedStatuses.length) throw new TypeError('health.expectedStatuses is invalid');
  return Object.freeze({ kind, url: url.toString(), expectedStatuses, timeoutMs: integer(value.timeoutMs, 5_000, 100, 60_000, 'health.timeoutMs') });
}

function normalizeBootstrap(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('bootstrap must be an object');
  const manifestPaths = Array.isArray(value.manifestPaths) ? [...new Set(value.manifestPaths.map(String).filter(Boolean))].slice(0, 256) : [];
  return Object.freeze({ command: required(value.command, 'bootstrap.command'), args: safeArgs(value.args, 'bootstrap.args'), manifestPaths, timeoutMs: integer(value.timeoutMs, 10 * 60_000, 1_000, 60 * 60_000, 'bootstrap.timeoutMs') });
}

function normalizedSpec(input) {
  const env = safeEnv(input.env ?? {});
  return {
    id: required(input.id, 'environment id'),
    projectId: required(input.projectId, 'projectId'),
    cwd: path.resolve(required(input.cwd, 'cwd')),
    command: required(input.command, 'command'),
    args: safeArgs(input.args),
    envNames: Object.keys(env).sort(),
    health: normalizeHealth(input.health),
    restart: Object.freeze({ maxAttempts: integer(input.restart?.maxAttempts, 3, 0, 20, 'restart.maxAttempts'), backoffMs: integer(input.restart?.backoffMs, 1_000, 0, 60_000, 'restart.backoffMs') }),
    bootstrap: normalizeBootstrap(input.bootstrap),
    metadata: redactSecrets(input.metadata && typeof input.metadata === 'object' ? structuredClone(input.metadata) : {}, { secretValues: Object.values(env) }),
  };
}

function publicState(row, spec) {
  const value = {
    schema: 'forge.environment-state.v1',
    id: row.environment_id,
    projectId: spec.projectId,
    state: row.state,
    reason: row.reason || null,
    pid: row.pid == null ? null : Number(row.pid),
    restartAttempts: Number(row.restart_attempts ?? 0),
    startedAt: row.started_at || null,
    updatedAt: row.updated_at,
    lastHealth: parse(row.last_health_json, null),
    environment: Object.freeze({ cwd: spec.cwd, command: spec.command, args: Object.freeze([...spec.args]), envNames: Object.freeze([...spec.envNames]), health: spec.health, restart: spec.restart, bootstrap: spec.bootstrap ? { command: spec.bootstrap.command, args: Object.freeze([...spec.bootstrap.args]), manifestPaths: Object.freeze([...spec.bootstrap.manifestPaths]) } : null }),
    receiptSha256: row.receipt_sha256 || null,
  };
  return Object.freeze(value);
}

async function defaultHealthProbe(health) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), health.timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(health.url, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { accept: 'application/json,text/plain,*/*' } });
    await response.body?.cancel?.().catch(() => {});
    return { reachable: true, status: response.status, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { reachable: false, errorCode: error?.cause?.code ?? error?.code ?? error?.name ?? 'HEALTH_REQUEST_FAILED', latencyMs: Math.round(performance.now() - started) };
  } finally { clearTimeout(timer); }
}

async function collectProcess(command, args, { cwd, env, timeoutMs, maxOutputBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const chunks = { stdout: [], stderr: [] }; const sizes = { stdout: 0, stderr: 0 };
    const append = (kind, chunk) => { const buffer = Buffer.from(chunk); const remaining = maxOutputBytes - sizes[kind]; if (remaining <= 0) return; chunks[kind].push(buffer.subarray(0, remaining)); sizes[kind] += Math.min(buffer.length, remaining); };
    child.stdout.on('data', (chunk) => append('stdout', chunk)); child.stderr.on('data', (chunk) => append('stderr', chunk));
    const timer = setTimeout(() => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ exitCode: Number.isInteger(code) ? code : null, signal: signal ?? null, stdout: Buffer.concat(chunks.stdout).toString('utf8'), stderr: Buffer.concat(chunks.stderr).toString('utf8') }); });
  });
}

export class NodeManagedProcessDriver {
  constructor({ root, maxPreviewBytes = 64_000 } = {}) {
    if (!root) throw new TypeError('NodeManagedProcessDriver root is required');
    this.root = path.resolve(root);
    this.maxPreviewBytes = integer(maxPreviewBytes, 64_000, 1_024, 5_000_000, 'maxPreviewBytes');
    this.handles = new Map();
  }

  async start(spec) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: { ...process.env, ...spec.env }, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const handle = new EventEmitter();
    Object.assign(handle, { pid: child.pid, stdoutPreview: '', stderrPreview: '' });
    const capture = (key, chunk) => { handle[key] = `${handle[key]}${Buffer.from(chunk).toString('utf8')}`.slice(-this.maxPreviewBytes); handle.emit(key === 'stdoutPreview' ? 'stdout' : 'stderr', Buffer.from(chunk).toString('utf8')); };
    child.stdout.on('data', (chunk) => capture('stdoutPreview', chunk));
    child.stderr.on('data', (chunk) => capture('stderrPreview', chunk));
    child.once('exit', (exitCode, signal) => { this.handles.delete(child.pid); handle.emit('exit', { exitCode: Number.isInteger(exitCode) ? exitCode : null, signal: signal ?? null }); });
    child.once('error', (error) => handle.emit('error', error));
    this.handles.set(child.pid, { child, handle });
    return handle;
  }

  isAlive(pid) {
    const number = Number(pid);
    if (!Number.isInteger(number) || number <= 0) return false;
    try { process.kill(number, 0); return true; } catch { return false; }
  }

  async stop(pid) {
    const number = Number(pid); const owned = this.handles.get(number);
    if (!this.isAlive(number)) return;
    try { if (process.platform !== 'win32') process.kill(-number, 'SIGTERM'); else owned?.child.kill('SIGTERM'); } catch {}
    const deadline = Date.now() + 5_000;
    while (this.isAlive(number) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    if (this.isAlive(number)) { try { if (process.platform !== 'win32') process.kill(-number, 'SIGKILL'); else owned?.child.kill('SIGKILL'); } catch {} }
  }

  async isPortOccupied({ hostname, port }) {
    return new Promise((resolve) => {
      const socket = net.connect({ host: hostname, port: Number(port) });
      const done = (value) => { socket.destroy(); resolve(value); };
      socket.setTimeout(300);
      socket.once('connect', () => done(true)); socket.once('timeout', () => done(false)); socket.once('error', () => done(false));
    });
  }
}

export class EnvironmentSupervisor {
  constructor({ file, root, processDriver = null, healthProbe = defaultHealthProbe, bootstrapRunner = null, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), clock = isoNow } = {}) {
    if (!file) throw new TypeError('EnvironmentSupervisor file is required');
    if (!root) throw new TypeError('EnvironmentSupervisor root is required');
    this.file = path.resolve(file); this.root = path.resolve(root); this.clock = clock; this.sleep = sleep;
    this.processDriver = processDriver ?? new NodeManagedProcessDriver({ root: path.join(this.root, 'processes') });
    this.healthProbe = healthProbe;
    this.bootstrapRunner = bootstrapRunner ?? ((request) => collectProcess(request.command, request.args, request));
    this.runtimeEnv = new Map(); this.handles = new Map(); this.closed = false;
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS environment_specs(environment_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,spec_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS environment_state(environment_id TEXT PRIMARY KEY REFERENCES environment_specs(environment_id) ON DELETE CASCADE,state TEXT NOT NULL,reason TEXT,pid INTEGER,restart_attempts INTEGER NOT NULL DEFAULT 0,started_at TEXT,updated_at TEXT NOT NULL,last_health_json TEXT,receipt_sha256 TEXT);
      CREATE TABLE IF NOT EXISTS environment_bootstrap_cache(environment_id TEXT PRIMARY KEY REFERENCES environment_specs(environment_id) ON DELETE CASCADE,manifest_sha256 TEXT NOT NULL,status TEXT NOT NULL,receipt_sha256 TEXT NOT NULL,updated_at TEXT NOT NULL);
    `);
  }

  register(input) {
    if (this.closed) throw new Error('EnvironmentSupervisor is closed');
    const spec = normalizedSpec(input); const env = safeEnv(input.env ?? {}); const stamp = this.clock();
    this.runtimeEnv.set(spec.id, env);
    this.db.prepare('INSERT INTO environment_specs(environment_id,project_id,spec_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(environment_id) DO UPDATE SET project_id=excluded.project_id,spec_json=excluded.spec_json,updated_at=excluded.updated_at')
      .run(spec.id, spec.projectId, encode(spec), stamp, stamp);
    this.db.prepare("INSERT INTO environment_state(environment_id,state,reason,pid,restart_attempts,started_at,updated_at,last_health_json,receipt_sha256) VALUES(?,'registered',NULL,NULL,0,NULL,?,NULL,NULL) ON CONFLICT(environment_id) DO NOTHING").run(spec.id, stamp);
    return this.state(spec.id);
  }

  #spec(environmentId) {
    const row = this.db.prepare('SELECT spec_json FROM environment_specs WHERE environment_id=?').get(required(environmentId, 'environment id'));
    if (!row) throw Object.assign(new Error(`Unknown environment: ${environmentId}`), { statusCode: 404, code: 'ENVIRONMENT_NOT_FOUND' });
    return parse(row.spec_json, {});
  }

  #row(environmentId) {
    const row = this.db.prepare('SELECT * FROM environment_state WHERE environment_id=?').get(required(environmentId, 'environment id'));
    if (!row) throw Object.assign(new Error(`Unknown environment: ${environmentId}`), { statusCode: 404, code: 'ENVIRONMENT_NOT_FOUND' });
    return row;
  }

  #writeState(environmentId, changes = {}) {
    const current = this.#row(environmentId); const stamp = this.clock();
    const next = {
      state: changes.state ?? current.state, reason: changes.reason === undefined ? current.reason : changes.reason,
      pid: changes.pid === undefined ? current.pid : changes.pid, restartAttempts: changes.restartAttempts ?? current.restart_attempts,
      startedAt: changes.startedAt === undefined ? current.started_at : changes.startedAt,
      lastHealth: changes.lastHealth === undefined ? parse(current.last_health_json, null) : changes.lastHealth,
    };
    const base = { schema: 'forge.environment-state-receipt.v1', environmentId, ...next, updatedAt: stamp };
    const receiptSha256 = canonicalSha256(base);
    this.db.prepare('UPDATE environment_state SET state=?,reason=?,pid=?,restart_attempts=?,started_at=?,updated_at=?,last_health_json=?,receipt_sha256=? WHERE environment_id=?')
      .run(next.state, next.reason, next.pid, next.restartAttempts, next.startedAt, stamp, encode(next.lastHealth), receiptSha256, environmentId);
    return this.state(environmentId);
  }

  state(environmentId) { const spec = this.#spec(environmentId); return publicState(this.#row(environmentId), spec); }
  list({ projectId = null } = {}) {
    const rows = projectId ? this.db.prepare('SELECT environment_id FROM environment_specs WHERE project_id=? ORDER BY environment_id').all(String(projectId)) : this.db.prepare('SELECT environment_id FROM environment_specs ORDER BY project_id,environment_id').all();
    return Object.freeze(rows.map((row) => this.state(row.environment_id)));
  }

  async environmentSnapshot(environmentId) {
    const spec = this.#spec(environmentId); const files = [];
    for (const item of spec.bootstrap?.manifestPaths ?? []) {
      const { absolute, relative } = safeRelative(spec.cwd, item);
      try {
        const info = await stat(absolute);
        if (!info.isFile()) { files.push({ path: relative, state: 'not-file' }); continue; }
        const content = await readFile(absolute);
        files.push({ path: relative, state: 'file', bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
      } catch (error) { if (error?.code === 'ENOENT') files.push({ path: relative, state: 'missing' }); else throw error; }
    }
    const manifest = { schema: 'forge.environment-manifest.v1', environmentId: spec.id, projectId: spec.projectId, cwd: spec.cwd, command: spec.command, args: spec.args, envNames: spec.envNames, bootstrap: spec.bootstrap ? { command: spec.bootstrap.command, args: spec.bootstrap.args } : null, files };
    return Object.freeze({ ...manifest, files: Object.freeze(files.map(Object.freeze)), manifestSha256: canonicalSha256(manifest) });
  }

  async #bootstrap(spec, env) {
    if (!spec.bootstrap) return null;
    const snapshot = await this.environmentSnapshot(spec.id);
    const cached = this.db.prepare('SELECT * FROM environment_bootstrap_cache WHERE environment_id=?').get(spec.id);
    if (cached?.status === 'pass' && cached.manifest_sha256 === snapshot.manifestSha256) return Object.freeze({ skipped: true, manifestSha256: snapshot.manifestSha256, receiptSha256: cached.receipt_sha256 });
    const result = await this.bootstrapRunner({ command: spec.bootstrap.command, args: spec.bootstrap.args, cwd: spec.cwd, env, timeoutMs: spec.bootstrap.timeoutMs, shell: false });
    const safe = redactSecrets({ exitCode: result.exitCode, signal: result.signal ?? null, stdoutPreview: String(result.stdout ?? '').slice(-8_000), stderrPreview: String(result.stderr ?? '').slice(-8_000) }, { secretValues: Object.values(env) });
    const base = { schema: 'forge.environment-bootstrap-receipt.v1', environmentId: spec.id, manifestSha256: snapshot.manifestSha256, result: safe, completedAt: this.clock() };
    const receiptSha256 = canonicalSha256(base); const status = result.exitCode === 0 ? 'pass' : 'fail';
    this.db.prepare('INSERT INTO environment_bootstrap_cache(environment_id,manifest_sha256,status,receipt_sha256,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(environment_id) DO UPDATE SET manifest_sha256=excluded.manifest_sha256,status=excluded.status,receipt_sha256=excluded.receipt_sha256,updated_at=excluded.updated_at')
      .run(spec.id, snapshot.manifestSha256, status, receiptSha256, base.completedAt);
    if (status !== 'pass') throw Object.assign(new Error('Environment bootstrap failed'), { code: 'ENVIRONMENT_BOOTSTRAP_FAILED', receiptSha256, details: safe });
    return Object.freeze({ skipped: false, manifestSha256: snapshot.manifestSha256, receiptSha256 });
  }

  async #health(spec) {
    if (!spec.health) return Object.freeze({ reachable: true, status: null, expected: true, classification: 'no-health-check' });
    const raw = await this.healthProbe(spec.health);
    const result = { reachable: raw?.reachable === true, status: Number.isInteger(raw?.status) ? raw.status : null, latencyMs: Number(raw?.latencyMs ?? 0), errorCode: optional(raw?.errorCode) };
    result.expected = result.reachable && spec.health.expectedStatuses.includes(result.status);
    result.classification = result.expected ? 'healthy' : result.reachable ? 'application-failure' : 'infrastructure-failure';
    return Object.freeze(result);
  }

  async #portConflict(spec) {
    if (!spec.health?.url || typeof this.processDriver.isPortOccupied !== 'function') return false;
    const url = new URL(spec.health.url); const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    return this.processDriver.isPortOccupied({ hostname: url.hostname, port });
  }

  async start(environmentId, { restartAttempts = null } = {}) {
    if (this.closed) throw new Error('EnvironmentSupervisor is closed');
    const spec = this.#spec(environmentId); const current = this.#row(environmentId);
    if (current.pid && this.processDriver.isAlive(current.pid)) return this.check(environmentId);
    const env = this.runtimeEnv.get(spec.id) ?? {};
    if (spec.envNames.length && spec.envNames.some((name) => !Object.hasOwn(env, name))) return this.#writeState(spec.id, { state: 'blocked', reason: 'secret-reinjection-required', pid: null });
    if (await this.#portConflict(spec)) return this.#writeState(spec.id, { state: 'blocked', reason: 'port-already-in-use', pid: null });
    await this.#bootstrap(spec, env);
    const handle = await this.processDriver.start({ cwd: spec.cwd, command: spec.command, args: spec.args, env, shell: false, logsRoot: path.join(this.root, spec.id) });
    if (!Number.isInteger(handle?.pid) || handle.pid <= 0) throw new Error('Managed process driver returned an invalid pid');
    this.handles.set(spec.id, handle);
    const attemptCount = restartAttempts === null ? Number(current.restart_attempts ?? 0) : Number(restartAttempts);
    this.#writeState(spec.id, { state: 'starting', reason: null, pid: handle.pid, restartAttempts: attemptCount, startedAt: this.clock(), lastHealth: null });
    handle.on?.('exit', (event) => {
      try {
        const latest = this.#row(spec.id);
        if (Number(latest.pid) !== Number(handle.pid)) return;
        this.#writeState(spec.id, { state: 'exited', reason: `process-exited:${event?.exitCode ?? 'null'}:${event?.signal ?? 'none'}`, pid: null });
      } catch {}
    });
    handle.on?.('error', (error) => { try { this.#writeState(spec.id, { state: 'degraded', reason: `process-error:${error?.code ?? 'unknown'}` }); } catch {} });
    return this.check(spec.id);
  }

  async check(environmentId) {
    const spec = this.#spec(environmentId); const current = this.#row(environmentId);
    const alive = current.pid != null && this.processDriver.isAlive(current.pid);
    if (!alive) return this.#writeState(spec.id, { state: 'exited', reason: current.reason ?? 'process-not-running', pid: null });
    const health = await this.#health(spec);
    if (health.expected) return this.#writeState(spec.id, { state: 'healthy', reason: null, lastHealth: health });
    if (health.classification === 'application-failure') return this.#writeState(spec.id, { state: 'needs-agent', reason: 'application-health-check-failed', lastHealth: health });
    return this.#writeState(spec.id, { state: 'degraded', reason: 'health-endpoint-unreachable', lastHealth: health });
  }

  async heal(environmentId) {
    const spec = this.#spec(environmentId); let current = this.#row(environmentId);
    const alive = current.pid != null && this.processDriver.isAlive(current.pid);
    if (alive) {
      const checked = await this.check(spec.id);
      if (checked.state === 'healthy') return Object.freeze({ ...checked, action: 'none' });
      if (checked.state === 'needs-agent') return Object.freeze({ ...checked, action: 'no-restart' });
      current = this.#row(spec.id);
    }
    const attempts = Number(current.restart_attempts ?? 0);
    if (attempts >= spec.restart.maxAttempts) return Object.freeze({ ...this.#writeState(spec.id, { state: 'blocked', reason: 'restart-budget-exhausted', pid: null }), action: 'blocked' });
    if (alive && current.pid) await this.processDriver.stop(current.pid);
    await this.sleep(Math.min(60_000, spec.restart.backoffMs * (2 ** attempts)));
    const restarted = await this.start(spec.id, { restartAttempts: attempts + 1 });
    return Object.freeze({ ...restarted, action: 'restarted' });
  }

  async recover(environmentId) {
    const current = this.#row(environmentId);
    if (current.pid && this.processDriver.isAlive(current.pid)) return this.check(environmentId);
    return this.heal(environmentId);
  }

  async stop(environmentId) {
    const current = this.#row(environmentId);
    if (current.pid && this.processDriver.isAlive(current.pid)) await this.processDriver.stop(current.pid);
    this.handles.delete(String(environmentId));
    return this.#writeState(String(environmentId), { state: 'stopped', reason: 'operator-stop', pid: null, restartAttempts: 0 });
  }

  close() { if (this.closed) return; this.closed = true; this.db.close(); }
}
