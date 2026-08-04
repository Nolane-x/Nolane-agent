import { spawn } from 'node:child_process';
import { createPlatformResourceDriver } from '../sandbox/platform-resource-driver.mjs';

function required(value, label, max = 240) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return text;
}

function freeze(value) { return Object.freeze(structuredClone(value)); }

export class ManagedProcessRegistry {
  constructor({ spawnImpl = spawn, processDriver = createPlatformResourceDriver(), maxOutputBytes = 256_000, stopGraceMs = 500 } = {}) {
    this.spawnImpl = spawnImpl;
    this.processDriver = processDriver;
    this.maxOutputBytes = Math.max(1_024, Number(maxOutputBytes) || 256_000);
    this.stopGraceMs = Math.max(10, Number(stopGraceMs) || 500);
    this.records = new Map();
    this.pendingIds = new Set();
  }

  #snapshot(record) {
    return freeze({
      id: record.id,
      pid: record.pid,
      command: record.command,
      args: [...record.args],
      cwd: record.cwd,
      state: record.state,
      startedAt: record.startedAt,
      exitCode: record.exitCode,
      signal: record.signal,
      stdout: record.stdout,
      stderr: record.stderr,
      truncated: record.truncated,
      rootIdentity: record.rootIdentity ? structuredClone(record.rootIdentity) : null,
      metadata: record.metadata,
    });
  }

  async start({ id, command, args = [], cwd, env = {}, stdin = '', startupDelayMs = 25, metadata = {} } = {}) {
    const serverId = required(id, 'id', 120);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(serverId)) throw new TypeError('managed process id is invalid');
    if (this.records.has(serverId) || this.pendingIds.has(serverId)) throw new Error(`Managed process is already managed: ${serverId}`);
    this.pendingIds.add(serverId);
    const executable = required(command, 'command', 4_096);
    if (!Array.isArray(args) || args.some((item) => typeof item !== 'string')) throw new TypeError('args must be strings');
    const child = this.spawnImpl(executable, args, {
      cwd,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      windowsHide: true,
    });
    const record = {
      id: serverId, child, pid: Number(child.pid), command: executable, args: [...args], cwd: String(cwd),
      state: 'starting', startedAt: new Date().toISOString(), exitCode: null, signal: null,
      stdout: '', stderr: '', keptBytes: 0, truncated: false, rootIdentity: null, registeredPids: [], metadata: structuredClone(metadata),
    };
    const append = (kind, chunk) => {
      const buffer = Buffer.from(chunk);
      const available = Math.max(0, this.maxOutputBytes - record.keptBytes);
      const kept = buffer.subarray(0, available);
      record.keptBytes += kept.length;
      if (buffer.length > available) record.truncated = true;
      if (kind === 'stdout') record.stdout += kept.toString('utf8'); else record.stderr += kept.toString('utf8');
    };
    child.stdout?.on('data', (chunk) => append('stdout', chunk));
    child.stderr?.on('data', (chunk) => append('stderr', chunk));
    child.stdin?.on('error', () => {});
    child.stdin?.end(String(stdin ?? ''));
    child.once('close', (exitCode, signal) => {
      record.state = 'exited'; record.exitCode = exitCode; record.signal = signal ?? null;
      this.records.delete(serverId);
      this.pendingIds.delete(serverId);
    });

    const delay = Math.max(0, Math.min(5_000, Number(startupDelayMs) || 0));
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => { if (settled) return; settled = true; child.off('error', onError); child.off('close', onClose); fn(value); };
        const onError = (error) => finish(reject, error);
        const onClose = (code, signal) => finish(reject, new Error(`Managed process exited during startup (${code ?? signal ?? 'unknown'})`));
        child.once('error', onError); child.once('close', onClose);
        const timer = setTimeout(() => {
          if (!Number.isInteger(record.pid) || record.pid <= 0) finish(reject, new Error('Managed process requires a positive PID'));
          else finish(resolve);
        }, delay); timer.unref?.();
      });
    } catch (error) {
      this.records.delete(serverId);
      this.pendingIds.delete(serverId);
      try { child.kill('SIGKILL'); } catch {}
      throw error;
    }
    this.pendingIds.delete(serverId);
    if (record.state === 'exited') throw new Error('Managed process exited during startup');
    if (typeof this.processDriver?.sampleTree === 'function') {
      try {
        const sample = await this.processDriver.sampleTree(record.pid);
        record.rootIdentity = sample.rootIdentity ? structuredClone(sample.rootIdentity) : null;
        record.registeredPids = Array.isArray(sample.pids) ? [...sample.pids] : [record.pid];
      } catch (error) {
        if (!['SANDBOX_PROCESS_NOT_FOUND', 'ENOENT', 'ESRCH', 'EACCES'].includes(error?.code)) throw error;
      }
    }
    this.records.set(serverId, record);
    record.state = 'running';
    return this.#snapshot(record);
  }

  list() {
    return [...this.records.values()].sort((a, b) => a.id.localeCompare(b.id)).map((record) => this.#snapshot(record));
  }

  async stop(id) {
    const serverId = required(id, 'id', 120);
    const record = this.records.get(serverId);
    if (!record) throw new Error(`Unknown managed process: ${serverId}`);
    const child = record.child;
    const exited = child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise((resolve) => child.once('close', resolve));
    const kill = async (signal) => {
      if (typeof this.processDriver?.killTree === 'function' && record.rootIdentity) {
        try {
          const latest = typeof this.processDriver.sampleTree === 'function' ? await this.processDriver.sampleTree(record.pid) : null;
          if (latest?.rootIdentity) record.rootIdentity = structuredClone(latest.rootIdentity);
          if (Array.isArray(latest?.pids)) record.registeredPids = [...latest.pids];
          await this.processDriver.killTree(record.pid, { signal, expectedRootIdentity: record.rootIdentity, allowedPids: record.registeredPids });
          return;
        } catch (error) {
          if (!['SANDBOX_PROCESS_NOT_FOUND', 'ENOENT', 'ESRCH'].includes(error?.code)) throw error;
          return;
        }
      }
      try {
        if (process.platform !== 'win32' && record.pid) process.kill(-record.pid, signal);
        else child.kill(signal);
      } catch { try { child.kill(signal); } catch {} }
    };
    await kill('SIGTERM');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, this.stopGraceMs))]);
    if (child.exitCode === null && child.signalCode === null) {
      await kill('SIGKILL');
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, this.stopGraceMs))]);
    }
    record.state = 'exited';
    this.records.delete(serverId);
    return this.#snapshot(record);
  }

  async close() {
    const ids = [...this.records.keys()];
    await Promise.allSettled(ids.map((id) => this.stop(id)));
  }
}
