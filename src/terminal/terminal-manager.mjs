import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { ShellCommandCodec } from '../security/shell-command-codec.mjs';

import { TerminalService } from './terminal-service.mjs';

const FORWARDED_EVENTS = ['output', 'exit', 'title', 'session-error', 'created'];

function inferShellKind(shell) {
  const name = String(shell ?? '').replaceAll('\\', '/').split('/').at(-1).replace(/\.exe$/i, '').toLowerCase();
  if (name === 'cmd') return 'cmd';
  if (name === 'powershell' || name === 'pwsh') return 'powershell';
  if (name === 'wsl' || name === 'wslhost') return 'wsl';
  return 'bash';
}

function pathResolveShell(shell) {
  const value = String(shell ?? '').trim();
  if (!value) throw new TypeError('Terminal shell is required');
  return path.resolve(value);
}

export class TerminalManager extends EventEmitter {
  constructor({
    projectResolver,
    clientFactory,
    allowedShells = [],
    maxSessionsPerProject = 4,
    governor,
    resourceSandbox = null,
    shellCodec = new ShellCommandCodec(),
    commandGovernance = null,
  } = {}) {
    super();
    if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
    if (typeof clientFactory !== 'function') throw new TypeError('clientFactory is required');
    this.projectResolver = projectResolver;
    this.clientFactory = clientFactory;
    this.allowedShells = [...allowedShells];
    this.allowedShellSet = new Set(this.allowedShells.map((item) => path.resolve(String(item))));
    this.maxSessionsPerProject = Math.max(1, Number(maxSessionsPerProject) || 4);
    this.governor = governor;
    this.resourceSandbox = resourceSandbox;
    this.shellCodec = shellCodec;
    this.commandGovernance = commandGovernance;
    this.services = new Map();
    this.sessions = new Map();
  }

  async #resolveProject(projectId) {
    const project = await this.projectResolver(projectId);
    if (!project?.workspaceRoot) throw new Error(`Unknown project: ${projectId}`);
    return project;
  }

  async #serviceFor(projectId) {
    const existing = this.services.get(projectId);
    if (existing) return existing;
    const project = await this.#resolveProject(projectId);
    const client = await this.clientFactory(project);
    const service = new TerminalService({
      client,
      workspaceRoot: project.workspaceRoot,
      allowedShells: this.allowedShells,
      maxSessions: this.maxSessionsPerProject,
      shellCodec: this.shellCodec,
    });
    for (const eventName of FORWARDED_EVENTS) {
      service.on(eventName, (event) => {
        if (eventName === 'exit') this.#handleExit(event.sessionId).catch((error) => this.emit('session-error', { projectId, sessionId: event.sessionId, error: String(error?.message ?? error) }));
        this.emit(eventName, { projectId, ...event });
      });
    }
    this.services.set(projectId, service);
    return service;
  }

  #owned(sessionId) {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`Unknown terminal session: ${sessionId}`);
    return record;
  }

  async #releaseSandbox(sessionId, { terminate = false } = {}) {
    const record = this.sessions.get(sessionId);
    if (!record?.sandboxLeaseId || !this.resourceSandbox) return;
    const leaseId = record.sandboxLeaseId;
    this.sessions.set(sessionId, { ...record, sandboxLeaseId: null });
    await this.resourceSandbox.closeLease(leaseId, { projectId: record.projectId, principalId: record.principalId, terminate });
  }

  async #handleExit(sessionId) {
    if (!this.sessions.has(sessionId)) return;
    await this.#releaseSandbox(sessionId, { terminate: false });
  }

  async create({ projectId, principalId = null, taskId = null, sandbox = null, ...request } = {}) {
    const project = await this.#resolveProject(projectId);
    const activeTerminals = this.sessions.size;
    const admission = this.governor?.canAdmit?.('terminal', { activeTerminals }) ?? this.governor?.admit?.('terminal');
    if (admission && admission.allowed === false) throw new Error(admission.reason || 'Terminal resource admission rejected');
    if (sandbox && !this.resourceSandbox) throw new Error('Local resource sandbox is not configured');
    const service = await this.#serviceFor(projectId);
    const sessionId = String(request.id ?? randomUUID());
    const shell = pathResolveShell(request.shell);
    if (!this.allowedShellSet.has(shell)) throw new Error('Terminal shell is not allowed');
    const prepared = this.shellCodec.prepareInteractive({ kind: request.shellKind ?? inferShellKind(shell), executable: shell, args: request.args ?? [], distribution: request.distribution ?? null });
    const governance = this.commandGovernance?.authorize({
      principalId: principalId ?? 'local-admin',
      projectId,
      taskId: String(taskId ?? '').trim() || `terminal:${projectId}`,
      sessionId,
      origin: 'user',
      command: prepared.executable,
      args: [...prepared.args],
      cwd: String(request.cwd ?? '.'),
      env: request.env ?? {},
      commandClass: 'interactive-shell',
      shellKind: prepared.kind,
    }) ?? null;
    let lease = null;
    let session = null;
    try {
      if (sandbox) {
        lease = await this.resourceSandbox.createLease({
          id: sandbox.id,
          projectId,
          workspaceRoot: project.workspaceRoot,
          principalId,
          limits: sandbox.limits ?? sandbox,
        });
      }
      session = await service.create({ ...request, id: sessionId });
      if (lease) {
        const pid = Number(session?.pid);
        if (!Number.isInteger(pid) || pid <= 0) throw new Error('Sandboxed terminal session requires a positive PID');
        await this.resourceSandbox.attachProcess(lease.id, pid, { projectId, principalId });
      }
      this.sessions.set(session.id, { projectId, service, principalId, sandboxLeaseId: lease?.id ?? null, governanceReceiptSha256: governance?.receiptSha256 ?? null });
      return { ...session, projectId, sandboxLeaseId: lease?.id ?? null, governanceReceiptSha256: governance?.receiptSha256 ?? null };
    } catch (error) {
      if (session?.id) await service.terminate(session.id).catch(() => {});
      if (lease?.id) await this.resourceSandbox.closeLease(lease.id, { projectId, principalId, terminate: false }).catch(() => {});
      throw error;
    }
  }

  async input(sessionId, data) { return this.#owned(sessionId).service.input(sessionId, data); }
  async resize(sessionId, cols, rows) { return this.#owned(sessionId).service.resize(sessionId, cols, rows); }
  async snapshot(sessionId, afterCursor = 0) { return this.#owned(sessionId).service.snapshot(sessionId, afterCursor); }

  async terminate(sessionId) {
    const { service } = this.#owned(sessionId);
    const result = await service.terminate(sessionId);
    await this.#releaseSandbox(sessionId, { terminate: false });
    this.sessions.delete(sessionId);
    return result;
  }

  async list() {
    const groups = await Promise.all([...this.services.entries()].map(async ([projectId, service]) => {
      const sessions = await service.list();
      for (const session of sessions) this.sessions.set(session.id, { ...this.sessions.get(session.id), projectId, service });
      return sessions.map((session) => ({ ...session, projectId }));
    }));
    return groups.flat();
  }

  async close() {
    await Promise.allSettled([...this.services.values()].map((service) => service.close()));
    await Promise.allSettled([...this.sessions.keys()].map((sessionId) => this.#releaseSandbox(sessionId, { terminate: false })));
    this.services.clear();
    this.sessions.clear();
  }
}
