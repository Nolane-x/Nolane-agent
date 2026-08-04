import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
function defaultRunner(command, args, options = {}) { return execFileAsync(command, args, { windowsHide: true, timeout: options.timeoutMs ?? 15_000, maxBuffer: options.maxOutputBytes ?? 256_000 }); }
function coded(code, message, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function safeId(value) { const text = String(value ?? '').trim(); if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(text)) throw new TypeError('Invalid Job Object id'); return text; }
function integer(value, label) { const number = Number(value); if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`); return number; }

export class WindowsJobObjectDriver {
  constructor({ platform = process.platform, helperPath = 'forge-job-object.exe', runner = defaultRunner } = {}) { this.platform = platform; this.helperPath = String(helperPath); this.runner = runner; }
  async capabilities() {
    if (this.platform !== 'win32') return Object.freeze({ schema: 'forge.windows-job-object-capabilities.v1', available: false, platform: this.platform, nativeHelperRequired: true, reason: 'wrong-platform' });
    try {
      const { stdout = '' } = await this.runner(this.helperPath, ['capabilities', '--json'], { timeoutMs: 5_000, maxOutputBytes: 64_000 });
      const parsed = JSON.parse(String(stdout));
      return Object.freeze({ schema: 'forge.windows-job-object-capabilities.v1', available: parsed?.jobObjects === true, platform: this.platform, nativeHelperRequired: true, version: parsed?.version ?? null });
    } catch (error) { return Object.freeze({ schema: 'forge.windows-job-object-capabilities.v1', available: false, platform: this.platform, nativeHelperRequired: true, reason: error?.code === 'ENOENT' ? 'helper-not-installed' : 'probe-failed' }); }
  }
  async #require() { const capability = await this.capabilities(); if (!capability.available) throw coded('WINDOWS_JOB_OBJECT_UNAVAILABLE', `Windows Job Object runtime unavailable: ${capability.reason ?? 'capability-failed'}`, 503); return capability; }
  async create({ id, limits = {} } = {}) { const jobId = safeId(id); await this.#require(); const args = ['create', '--id', jobId, '--cpu-percent', String(integer(limits.cpuPercent, 'cpuPercent')), '--memory-bytes', String(integer(limits.memoryBytes, 'memoryBytes')), '--process-count', String(integer(limits.processCount, 'processCount'))]; await this.runner(this.helperPath, args, { timeoutMs: 15_000, maxOutputBytes: 64_000 }); return Object.freeze({ schema: 'forge.windows-job-object.v1', id: jobId, state: 'created' }); }
  async attach({ id, pid } = {}) { const jobId = safeId(id); await this.#require(); const processId = integer(pid, 'pid'); await this.runner(this.helperPath, ['attach', '--id', jobId, '--pid', String(processId)], { timeoutMs: 15_000, maxOutputBytes: 64_000 }); return Object.freeze({ id: jobId, pid: processId, state: 'attached' }); }
  async terminate({ id } = {}) { const jobId = safeId(id); await this.#require(); await this.runner(this.helperPath, ['terminate', '--id', jobId], { timeoutMs: 15_000, maxOutputBytes: 64_000 }); return Object.freeze({ id: jobId, state: 'terminated' }); }
}
