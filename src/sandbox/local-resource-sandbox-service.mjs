import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { CgroupV2ResourceDriver } from './cgroup-v2-resource-driver.mjs';
import { createPlatformResourceDriver } from './platform-resource-driver.mjs';
import { measureWorkspace } from './workspace-disk-meter.mjs';
import { PodmanSandboxDriver } from './podman-sandbox-driver.mjs';
import { WindowsJobObjectDriver } from './windows-job-object-driver.mjs';
import { MacOsSandboxDriver } from './macos-sandbox-driver.mjs';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const TIB = 1024 * GIB;

function coded(code, message, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function boundedInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new TypeError(`${label} must be between ${minimum} and ${maximum}`);
  return number;
}
function limitsOf(value = {}) {
  return Object.freeze({
    cpuPercent: boundedInteger(value.cpuPercent, 1, 1000, 'cpuPercent'),
    memoryBytes: boundedInteger(value.memoryBytes, 16 * MIB, 64 * GIB, 'memoryBytes'),
    processCount: boundedInteger(value.processCount, 1, 4096, 'processCount'),
    diskBytes: boundedInteger(value.diskBytes, MIB, TIB, 'diskBytes'),
    sampleIntervalMs: boundedInteger(value.sampleIntervalMs ?? 2000, 250, 60_000, 'sampleIntervalMs'),
    violationGraceSamples: boundedInteger(value.violationGraceSamples ?? 2, 1, 20, 'violationGraceSamples'),
  });
}
function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function parse(text, fallback = null) { try { return JSON.parse(text); } catch { return fallback; } }

export class LocalResourceSandboxService {
  constructor({
    file,
    projectResolver,
    procDriver = createPlatformResourceDriver(),
    cgroupDriver = new CgroupV2ResourceDriver(),
    diskMeter = measureWorkspace,
    eventSink = () => {},
    clockMs = () => Date.now(),
    autoMonitor = true,
    podmanDriver = new PodmanSandboxDriver(),
    windowsJobObjectDriver = new WindowsJobObjectDriver(),
    macOsSandboxDriver = new MacOsSandboxDriver(),
  } = {}) {
    if (!file) throw new TypeError('LocalResourceSandboxService file is required');
    if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new DatabaseSync(path.resolve(file));
    this.projectResolver = projectResolver;
    this.procDriver = procDriver;
    this.cgroupDriver = cgroupDriver;
    this.diskMeter = diskMeter;
    this.eventSink = eventSink;
    this.clockMs = clockMs;
    this.autoMonitor = autoMonitor;
    this.nativeDrivers = Object.freeze({ podman: podmanDriver, windowsJobObjects: windowsJobObjectDriver, macOsSandbox: macOsSandboxDriver });
    this.runtime = new Map();
    this.closed = false;
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS local_resource_sandbox_leases(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        state TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS local_resource_sandbox_project_idx ON local_resource_sandbox_leases(project_id, updated_at DESC);
    `);
  }

  #stamp(ms = this.clockMs()) { return new Date(ms).toISOString(); }

  #load(id) {
    const row = this.db.prepare('SELECT record_json FROM local_resource_sandbox_leases WHERE id=?').get(required(id, 'lease id'));
    if (!row) throw coded('LOCAL_SANDBOX_NOT_FOUND', `Unknown local resource sandbox: ${id}`, 404);
    return parse(row.record_json, {});
  }

  #scope(record, { projectId = null, principalId = null } = {}) {
    if (projectId != null && String(projectId) !== String(record.projectId)) throw coded('LOCAL_SANDBOX_SCOPE_DENIED', 'Local resource sandbox project scope denied', 403);
    if (principalId != null && String(principalId) !== String(record.principalId)) throw coded('LOCAL_SANDBOX_SCOPE_DENIED', 'Local resource sandbox principal scope denied', 403);
    return record;
  }

  #save(record, eventType = null) {
    const updatedAt = this.#stamp();
    const base = { ...record, updatedAt };
    delete base.receiptSha256;
    const saved = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.db.prepare(`INSERT INTO local_resource_sandbox_leases(id,project_id,principal_id,state,record_json,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,principal_id=excluded.principal_id,state=excluded.state,record_json=excluded.record_json,updated_at=excluded.updated_at`)
      .run(saved.id, saved.projectId, saved.principalId, saved.state, JSON.stringify(saved), saved.updatedAt);
    if (eventType) this.eventSink(freeze({ type: eventType, leaseId: saved.id, projectId: saved.projectId, principalId: saved.principalId, state: saved.state, receiptSha256: saved.receiptSha256, at: saved.updatedAt, violations: saved.violations ?? [] }));
    return saved;
  }

  async capabilities() {
    const [cgroupV2, podman, windowsJobObjects, macOsSandbox] = await Promise.all([
      process.platform === 'linux' ? this.cgroupDriver.available().catch(() => false) : false,
      this.nativeDrivers.podman.capabilities().catch(() => ({ available: false, reason: 'probe-failed' })),
      this.nativeDrivers.windowsJobObjects.capabilities().catch(() => ({ available: false, reason: 'probe-failed' })),
      this.nativeDrivers.macOsSandbox.capabilities().catch(() => ({ available: false, reason: 'probe-failed' })),
    ]);
    return freeze({
      schema: 'forge.local-resource-sandbox-capabilities.v1',
      platform: process.platform,
      cgroupV2,
      watchdogTerminate: true,
      limits: ['cpu', 'memory', 'process', 'disk'],
      windowsJobObjects: windowsJobObjects.available === true,
      macOsSandbox: macOsSandbox.available === true,
      podman: podman.available === true,
      namespaceIsolation: podman.available === true,
      nativeDrivers: { podman, windowsJobObjects, macOsSandbox },
    });
  }

  async createLease(input = {}) {
    if (this.closed) throw new Error('LocalResourceSandboxService is closed');
    const id = String(input.id ?? randomUUID());
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) throw new TypeError('Invalid lease id');
    const projectId = required(input.projectId, 'projectId');
    const principalId = required(input.principalId, 'principalId');
    const project = this.projectResolver(projectId);
    if (!project?.workspaceRoot) throw coded('LOCAL_SANDBOX_PROJECT_NOT_FOUND', `Unknown project: ${projectId}`, 404);
    const projectRoot = path.resolve(project.workspaceRoot);
    const workspaceRoot = path.resolve(required(input.workspaceRoot, 'workspaceRoot'));
    if (workspaceRoot !== projectRoot) throw coded('LOCAL_SANDBOX_WORKSPACE_MISMATCH', 'Sandbox workspace root must match the project workspace root', 403);
    const limits = limitsOf(input.limits);
    const createdAt = this.#stamp();
    let mode = 'watchdog-terminate';
    let cgroupLease = null;
    if (process.platform === 'linux' && await this.cgroupDriver.available().catch(() => false)) {
      cgroupLease = await this.cgroupDriver.createLease(id, limits);
      mode = 'cgroup-v2';
    }
    this.runtime.set(id, { cgroupLease, timer: null, retainTimer: null });
    return this.#save({
      schema: 'forge.local-resource-sandbox-lease.v1', id, projectId, workspaceRoot, principalId,
      state: 'created', mode, cgroupPath: cgroupLease?.path ?? null, limits, attachedPid: null, usage: null, consecutiveViolations: 0,
      violations: [], violation: null, createdAt, closedAt: null,
    }, 'local-resource-sandbox.created');
  }

  status(id, scope = {}) { return freeze(this.#scope(this.#load(id), scope)); }

  list({ projectId = null, principalId = null } = {}) {
    let rows;
    if (projectId != null && principalId != null) rows = this.db.prepare('SELECT record_json FROM local_resource_sandbox_leases WHERE project_id=? AND principal_id=? ORDER BY updated_at DESC').all(String(projectId), String(principalId));
    else if (projectId != null) rows = this.db.prepare('SELECT record_json FROM local_resource_sandbox_leases WHERE project_id=? ORDER BY updated_at DESC').all(String(projectId));
    else if (principalId != null) rows = this.db.prepare('SELECT record_json FROM local_resource_sandbox_leases WHERE principal_id=? ORDER BY updated_at DESC').all(String(principalId));
    else rows = this.db.prepare('SELECT record_json FROM local_resource_sandbox_leases ORDER BY updated_at DESC').all();
    return freeze(rows.map((row) => parse(row.record_json, {})));
  }

  async attachProcess(id, pidValue, scope = {}) {
    const record = this.#scope(this.#load(id), scope);
    if (!['created', 'active', 'pressure'].includes(record.state)) throw coded('LOCAL_SANDBOX_NOT_ATTACHABLE', `Sandbox state ${record.state} cannot attach a process`, 409);
    const pid = boundedInteger(pidValue, 1, 2_147_483_647, 'pid');
    const runtime = this.runtime.get(record.id) ?? { cgroupLease: record.mode === 'cgroup-v2' ? { id: record.id, path: record.cgroupPath } : null, timer: null, retainTimer: null };
    if (record.mode === 'cgroup-v2') await this.cgroupDriver.attach(runtime.cgroupLease, pid);
    const saved = this.#save({ ...record, attachedPid: pid, state: 'active', consecutiveViolations: 0, violations: [] }, 'local-resource-sandbox.attached');
    if (this.autoMonitor && !runtime.timer) {
      runtime.timer = setInterval(() => this.sample(id, { projectId: saved.projectId, principalId: saved.principalId }).catch(() => {}), saved.limits.sampleIntervalMs);
      runtime.timer.unref?.();
    }
    this.runtime.set(id, runtime);
    return saved;
  }

  async sample(id, scope = {}) {
    const record = this.#scope(this.#load(id), scope);
    if (!record.attachedPid) throw coded('LOCAL_SANDBOX_PROCESS_REQUIRED', 'Sandbox has no attached process', 409);
    if (!['active', 'pressure', 'retained'].includes(record.state)) return freeze(record);
    const runtime = this.runtime.get(record.id) ?? { cgroupLease: record.mode === 'cgroup-v2' ? { id: record.id, path: record.cgroupPath } : null, timer: null, retainTimer: null };
    const raw = record.mode === 'cgroup-v2'
      ? await this.cgroupDriver.sample(runtime.cgroupLease)
      : await this.procDriver.sampleTree(record.attachedPid);
    const disk = await this.diskMeter(record.workspaceRoot, { maxEntries: 100_000, maxBytes: record.limits.diskBytes + 1 });
    const sampledAtMs = this.clockMs();
    const previous = record.usage;
    const elapsed = previous ? Math.max(1, sampledAtMs - Number(previous.sampledAtMs)) : 0;
    const cpuDelta = previous ? Math.max(0, Number(raw.cpuTimeMs) - Number(previous.cpuTimeMs)) : 0;
    const cpuPercent = previous ? Number(((cpuDelta / elapsed) * 100).toFixed(3)) : 0;
    const usage = freeze({
      sampledAt: this.#stamp(sampledAtMs), sampledAtMs,
      cpuTimeMs: Number(raw.cpuTimeMs) || 0, cpuPercent,
      memoryBytes: Math.max(0, Number(raw.rssBytes) || 0),
      processCount: Math.max(0, Number(raw.processCount) || 0),
      diskBytes: Math.max(0, Number(disk.bytes) || 0),
      diskTruncated: disk.truncated === true,
    });
    const violations = [];
    const compare = (dimension, actual, limit) => { if (actual > limit) violations.push(freeze({ dimension, actual, limit })); };
    compare('cpu', usage.cpuPercent, record.limits.cpuPercent);
    compare('memory', usage.memoryBytes, record.limits.memoryBytes);
    compare('process', usage.processCount, record.limits.processCount);
    compare('disk', usage.diskBytes, record.limits.diskBytes);
    const consecutiveViolations = violations.length ? Number(record.consecutiveViolations ?? 0) + 1 : 0;
    let next = { ...record, usage, violations, consecutiveViolations, state: record.retainedUntilMs ? 'retained' : (violations.length ? 'pressure' : 'active') };
    if (violations.length && consecutiveViolations >= record.limits.violationGraceSamples) {
      await this.procDriver.terminateTree(record.attachedPid, { signal: 'SIGTERM' });
      if (record.mode === 'cgroup-v2' && runtime.cgroupLease) await this.cgroupDriver.remove(runtime.cgroupLease).catch(() => {});
      if (runtime.timer) clearInterval(runtime.timer);
      runtime.timer = null;
      next = { ...next, state: 'violated', violation: { at: usage.sampledAt, violations }, closedAt: usage.sampledAt };
      this.runtime.set(id, runtime);
      return this.#save(next, 'local-resource-sandbox.violation');
    }
    this.runtime.set(id, runtime);
    return this.#save(next, violations.length ? 'local-resource-sandbox.pressure' : null);
  }

  async retainLease(id, { retainForMs = 900_000, ...scope } = {}) {
    const record = this.#scope(this.#load(id), scope);
    if (!['created', 'active', 'pressure', 'retained'].includes(record.state)) throw coded('LOCAL_SANDBOX_NOT_RETAINABLE', `Sandbox state ${record.state} cannot be retained`, 409);
    const duration = boundedInteger(retainForMs, 1_000, 86_400_000, 'retainForMs');
    const runtime = this.runtime.get(record.id) ?? { cgroupLease: record.mode === 'cgroup-v2' ? { id: record.id, path: record.cgroupPath } : null, timer: null, retainTimer: null };
    if (runtime.retainTimer) clearTimeout(runtime.retainTimer);
    const retainUntilMs = this.clockMs() + duration;
    runtime.retainTimer = setTimeout(() => this.closeLease(id, { projectId: record.projectId, principalId: record.principalId, terminate: true }).catch(() => {}), duration);
    runtime.retainTimer.unref?.();
    this.runtime.set(id, runtime);
    return this.#save({ ...record, state: 'retained', retainedAt: this.#stamp(), retainedUntilMs: retainUntilMs, retainedUntil: this.#stamp(retainUntilMs) }, 'local-resource-sandbox.retained');
  }

  async closeLease(id, { terminate = true, ...scope } = {}) {
    const record = this.#scope(this.#load(id), scope);
    if (record.state === 'closed') return freeze(record);
    const runtime = this.runtime.get(record.id);
    if (runtime?.timer) clearInterval(runtime.timer);
    if (runtime?.retainTimer) clearTimeout(runtime.retainTimer);
    if (terminate && record.attachedPid && !['violated', 'closed'].includes(record.state)) await this.procDriver.terminateTree(record.attachedPid, { signal: 'SIGTERM' }).catch(() => {});
    if (record.mode === 'cgroup-v2' && runtime?.cgroupLease) await this.cgroupDriver.remove(runtime.cgroupLease).catch(() => {});
    this.runtime.delete(record.id);
    return this.#save({ ...record, state: 'closed', closedAt: this.#stamp(), violations: record.violations ?? [] }, 'local-resource-sandbox.closed');
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const runtime of this.runtime.values()) { if (runtime.timer) clearInterval(runtime.timer); if (runtime.retainTimer) clearTimeout(runtime.retainTimer); }
    this.runtime.clear();
    this.db.close();
  }
}
