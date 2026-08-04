import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

import { ShellCommandCodec } from '../security/shell-command-codec.mjs';


function inferShellKind(shell) {
  const name = path.basename(String(shell ?? '')).replace(/\.exe$/i, '').toLowerCase();
  if (name === 'cmd') return 'cmd';
  if (name === 'powershell' || name === 'pwsh') return 'powershell';
  if (name === 'wsl' || name === 'wslhost') return 'wsl';
  return 'bash';
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export class TerminalService extends EventEmitter {
  constructor({ client, workspaceRoot, allowedShells = [], maxSessions = 4, defaultCols = 100, defaultRows = 30, shellCodec = new ShellCommandCodec() } = {}) {
    super();
    if (!client) throw new TypeError('PTY client is required');
    if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
    this.client = client;
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.allowedShells = new Set(allowedShells.map((item) => path.resolve(String(item))));
    this.maxSessions = Math.max(1, Number(maxSessions) || 4);
    this.defaultCols = defaultCols;
    this.defaultRows = defaultRows;
    this.shellCodec = shellCodec;
    this.sessions = new Map();
    client.on('session/output', (event) => this.emit('output', event));
    client.on('session/exit', (event) => {
      const current = this.sessions.get(event.sessionId);
      if (current) this.sessions.set(event.sessionId, { ...current, state: 'exited', exitCode: event.exitCode, signal: event.signal });
      this.emit('exit', event);
    });
    client.on('session/title', (event) => this.emit('title', event));
    client.on('session/error', (event) => this.emit('session-error', event));
  }

  async #safeCwd(value) {
    const requested = path.resolve(this.workspaceRoot, value || '.');
    if (!isInside(this.workspaceRoot, requested)) throw new Error('Terminal cwd is outside workspace');
    let rootReal; let candidateReal;
    try { [rootReal, candidateReal] = await Promise.all([realpath(this.workspaceRoot), realpath(requested)]); }
    catch { throw new Error('Terminal cwd does not exist'); }
    if (!isInside(rootReal, candidateReal)) throw new Error('Terminal cwd is outside workspace through a symlink');
    return candidateReal;
  }

  #safeShell(value) {
    const shell = path.resolve(String(value ?? ''));
    if (!this.allowedShells.has(shell)) throw new Error('Terminal shell is not allowed');
    return shell;
  }

  async create({ id = randomUUID(), cwd = '.', shell, shellKind = null, distribution = null, args = [], cols = this.defaultCols, rows = this.defaultRows, env = {} } = {}) {
    const active = [...this.sessions.values()].filter((item) => item.state !== 'exited').length;
    if (active >= this.maxSessions) throw new Error(`Terminal session limit reached (${this.maxSessions})`);
    const safeCwd = await this.#safeCwd(cwd);
    const safeShell = this.#safeShell(shell);
    const prepared = this.shellCodec.prepareInteractive({ kind: shellKind ?? inferShellKind(safeShell), executable: safeShell, args, distribution });
    const safeEnv = Object.fromEntries(Object.entries(env).filter(([key, value]) => /^[A-Z_][A-Z0-9_]*$/i.test(key) && typeof value === 'string').slice(0, 64));
    const validated = this.shellCodec.validateArgv({ command: prepared.executable, args: prepared.args, env: safeEnv });
    const result = await this.client.request('session/create', {
      id, cwd: safeCwd, shell: validated.command, args: [...validated.args], cols: Math.max(20, Math.min(500, Number(cols) || this.defaultCols)), rows: Math.max(5, Math.min(200, Number(rows) || this.defaultRows)), env: { ...validated.env },
    });
    const session = Object.freeze({ ...result, id, cwd: safeCwd, shell: validated.command, shellKind: prepared.kind, args: [...validated.args], state: result?.state ?? 'running' });
    this.sessions.set(id, session);
    this.emit('created', session);
    return session;
  }

  input(sessionId, data) {
    if (!this.sessions.has(sessionId)) return Promise.reject(new Error('Unknown terminal session'));
    const value = String(data ?? '');
    if (Buffer.byteLength(value) > 64 * 1024) return Promise.reject(new Error('Terminal input exceeds 65536 bytes'));
    return this.client.request('session/input', { sessionId, data: value });
  }

  resize(sessionId, cols, rows) {
    if (!this.sessions.has(sessionId)) return Promise.reject(new Error('Unknown terminal session'));
    return this.client.request('session/resize', { sessionId, cols: Math.max(20, Math.min(500, Number(cols) || this.defaultCols)), rows: Math.max(5, Math.min(200, Number(rows) || this.defaultRows)) });
  }

  snapshot(sessionId, afterCursor = 0) { return this.client.request('session/snapshot', { sessionId, afterCursor: Math.max(0, Number(afterCursor) || 0) }); }
  async terminate(sessionId) {
    if (!this.sessions.has(sessionId)) throw new Error('Unknown terminal session');
    const result = await this.client.request('session/terminate', { sessionId });
    const current = this.sessions.get(sessionId); this.sessions.set(sessionId, { ...current, state: 'exited' });
    return result;
  }
  async list() {
    const remote = await this.client.request('session/list');
    for (const session of remote) this.sessions.set(session.id, { ...this.sessions.get(session.id), ...session });
    return remote;
  }
  async close() {
    await Promise.allSettled([...this.sessions.values()].filter((session) => session.state !== 'exited').map((session) => this.terminate(session.id)));
    await this.client.close();
  }
}
