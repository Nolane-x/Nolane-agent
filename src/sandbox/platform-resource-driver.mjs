import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { LinuxProcResourceDriver } from './linux-proc-resource-driver.mjs';

const execFileAsync = promisify(execFile);
function positivePid(value) { const pid = Number(value); if (!Number.isInteger(pid) || pid <= 0) throw new TypeError('pid must be a positive integer'); return pid; }
function descendants(records, rootPid) {
  const byPid = new Map(records.map((record) => [record.pid, record]));
  if (!byPid.has(rootPid)) throw Object.assign(new Error(`Process ${rootPid} is unavailable`), { code: 'SANDBOX_PROCESS_NOT_FOUND' });
  const children = new Map();
  for (const record of records) { const list = children.get(record.ppid) ?? []; list.push(record.pid); children.set(record.ppid, list); }
  const queue = [rootPid]; const seen = new Set();
  while (queue.length) { const pid = queue.shift(); if (seen.has(pid) || !byPid.has(pid)) continue; seen.add(pid); for (const child of children.get(pid) ?? []) queue.push(child); }
  return [...seen].sort((a, b) => a - b).map((pid) => byPid.get(pid));
}
function defaultExecutor(command, args) { return execFileAsync(command, args, { windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }); }

export class WindowsProcessResourceDriver {
  constructor({ executor = defaultExecutor, powershell = 'powershell.exe', taskkill = 'taskkill.exe' } = {}) { this.executor = executor; this.powershell = powershell; this.taskkill = taskkill; }
  async #records() {
    const script = "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,KernelModeTime,UserModeTime,WorkingSetSize,CreationDate) | ConvertTo-Json -Compress";
    const { stdout } = await this.executor(this.powershell, ['-NoProfile', '-NonInteractive', '-Command', script]);
    const parsed = JSON.parse(String(stdout || '[]'));
    return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
      pid: Number(item.ProcessId), ppid: Number(item.ParentProcessId),
      cpuTimeMs: (Number(item.KernelModeTime ?? 0) + Number(item.UserModeTime ?? 0)) / 10_000,
      rssBytes: Math.max(0, Number(item.WorkingSetSize ?? 0)), creationDate: String(item.CreationDate ?? ''),
    })).filter((item) => Number.isInteger(item.pid) && item.pid > 0);
  }
  async sampleTree(rootPid) {
    const records = descendants(await this.#records(), positivePid(rootPid));
    return Object.freeze({ cpuTimeMs: records.reduce((sum, item) => sum + item.cpuTimeMs, 0), rssBytes: records.reduce((sum, item) => sum + item.rssBytes, 0), processCount: records.length, pids: Object.freeze(records.map((item) => item.pid)), rootIdentity: Object.freeze({ pid: positivePid(rootPid), creationDate: String(records.find((item) => item.pid === positivePid(rootPid))?.creationDate ?? '') }) });
  }
  async killTree(rootPid, { expectedRootIdentity = null } = {}) {
    const pid = positivePid(rootPid);
    if (expectedRootIdentity) { const sample = await this.sampleTree(pid); if (Number(expectedRootIdentity.pid) !== pid || String(expectedRootIdentity.creationDate ?? '') !== String(sample.rootIdentity.creationDate ?? '')) throw Object.assign(new Error('Process root identity mismatch'), { code: 'PROCESS_IDENTITY_MISMATCH' }); }
    await this.executor(this.taskkill, ['/PID', String(pid), '/T', '/F']);
    return Object.freeze({ terminated: Object.freeze([pid]), signal: 'taskkill-tree-force' });
  }
  async terminateTree(rootPid, options = {}) { return this.killTree(rootPid, options); }
  async isTreeAlive(rootPid) { try { await this.sampleTree(rootPid); return true; } catch (error) { if (error?.code === 'SANDBOX_PROCESS_NOT_FOUND') return false; throw error; } }
}

function parseCpuTime(value) {
  const text = String(value ?? '0').trim();
  const daySplit = text.split('-');
  const days = daySplit.length > 1 ? Number(daySplit.shift()) || 0 : 0;
  const parts = daySplit.join('-').split(':').map(Number);
  let hours = 0; let minutes = 0; let seconds = 0;
  if (parts.length === 3) [hours, minutes, seconds] = parts;
  else if (parts.length === 2) [minutes, seconds] = parts;
  else seconds = parts[0] || 0;
  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

export class PsProcessResourceDriver {
  constructor({ executor = defaultExecutor, kill = process.kill.bind(process) } = {}) { this.executor = executor; this.kill = kill; }
  async #records() {
    const { stdout } = await this.executor('ps', ['-axo', 'pid=,ppid=,rss=,time=']);
    return String(stdout).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/); if (!match) return null;
      return { pid: Number(match[1]), ppid: Number(match[2]), rssBytes: Number(match[3]) * 1024, cpuTimeMs: parseCpuTime(match[4]) };
    }).filter(Boolean);
  }
  async sampleTree(rootPid) { const pid = positivePid(rootPid); const records = descendants(await this.#records(), pid); return Object.freeze({ cpuTimeMs: records.reduce((s, i) => s + i.cpuTimeMs, 0), rssBytes: records.reduce((s, i) => s + i.rssBytes, 0), processCount: records.length, pids: Object.freeze(records.map((i) => i.pid)), rootIdentity: Object.freeze({ pid }) }); }
  async killTree(rootPid, { signal = 'SIGTERM', expectedRootIdentity = null, allowedPids = null } = {}) { const sample = await this.sampleTree(rootPid); if (expectedRootIdentity && Number(expectedRootIdentity.pid) !== sample.rootIdentity.pid) throw Object.assign(new Error('Process root identity mismatch'), { code: 'PROCESS_IDENTITY_MISMATCH' }); const allowed = allowedPids == null ? null : new Set(allowedPids.map(Number)); const outside = allowed ? sample.pids.filter((pid) => !allowed.has(pid)) : []; if (outside.length) throw Object.assign(new Error('Process tree contains PIDs outside the registered set'), { code: 'PROCESS_TREE_OUTSIDE_REGISTERED', outsidePids: outside }); const terminated = []; for (const pid of [...sample.pids].reverse()) { try { this.kill(pid, signal); terminated.push(pid); } catch (error) { if (error?.code !== 'ESRCH') throw error; } } return Object.freeze({ terminated: Object.freeze(terminated), signal }); }
  async terminateTree(rootPid, options = {}) { return this.killTree(rootPid, options); }
  async isTreeAlive(rootPid) { try { await this.sampleTree(rootPid); return true; } catch (error) { if (error?.code === 'SANDBOX_PROCESS_NOT_FOUND') return false; throw error; } }
}

export function createPlatformResourceDriver({ platform = process.platform, ...options } = {}) {
  if (platform === 'win32') return new WindowsProcessResourceDriver(options);
  if (platform === 'linux') return new LinuxProcResourceDriver(options);
  return new PsProcessResourceDriver(options);
}
