import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
const bounded = (buffer, maxBytes) => ({ bytes: buffer.length, truncated: buffer.length > maxBytes, text: buffer.subarray(0, maxBytes).toString('utf8') });
const redact = (text, values) => values.reduce((result, value) => value ? result.split(value).join('[REDACTED]') : result, text);

export class LocalProcessBackend {
  constructor({ id = 'local', workspaceRoot, maxOutputBytes = 1_000_000, credentialResolver = () => null, baseEnv = process.env } = {}) {
    if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
    this.id = String(id);
    this.kind = 'local-process';
    this.capabilities = Object.freeze(['cancel', 'non-pty', 'process-tree', 'resource-budget']);
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.maxOutputBytes = Math.max(1, Number(maxOutputBytes) || 1_000_000);
    this.credentialResolver = credentialResolver;
    this.baseEnv = baseEnv;
    this.active = new Set();
  }

  available() { return true; }

  async #safeCwd(value) {
    const candidate = path.resolve(value ?? this.workspaceRoot);
    if (!inside(this.workspaceRoot, candidate)) throw Object.assign(new Error('Working directory is outside workspace'), { code: 'PATH_OUTSIDE_WORKSPACE' });
    const [realRoot, realCandidate] = await Promise.all([realpath(this.workspaceRoot), realpath(candidate)]);
    if (!inside(realRoot, realCandidate)) throw Object.assign(new Error('Working directory resolves through a symlink outside workspace'), { code: 'SYMLINK_ESCAPE' });
    return realCandidate;
  }

  async execute({ command, args = [], cwd = this.workspaceRoot, envRefs = {}, signal = null, timeoutMs = 0, mode = 'non-pty' } = {}) {
    if (!String(command ?? '').trim()) throw Object.assign(new TypeError('command is required'), { code: 'INVALID_INPUT' });
    if (!Array.isArray(args)) throw Object.assign(new TypeError('args must be an array'), { code: 'INVALID_INPUT' });
    if (mode !== 'non-pty') throw Object.assign(new Error('LocalProcessBackend supports non-pty execution only'), { code: 'PTY_UNAVAILABLE' });
    const safeCwd = await this.#safeCwd(cwd);
    const secrets = [];
    const resolvedEnv = {};
    for (const [name, reference] of Object.entries(envRefs ?? {})) {
      const value = await this.credentialResolver(String(reference));
      if (value == null) throw Object.assign(new Error(`Credential reference unavailable: ${reference}`), { code: 'CREDENTIAL_UNAVAILABLE', reference: String(reference) });
      resolvedEnv[String(name)] = String(value);
      secrets.push(String(value));
    }
    return new Promise((resolve, reject) => {
      const child = spawn(String(command), args.map(String), {
        cwd: safeCwd,
        env: { ...this.baseEnv, ...resolvedEnv },
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.active.add(child);
      const stdout = [];
      const stderr = [];
      let settled = false;
      let timedOut = false;
      const terminate = () => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {}
      };
      const onAbort = () => terminate();
      if (signal?.aborted) onAbort(); else signal?.addEventListener?.('abort', onAbort, { once: true });
      const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; terminate(); }, Number(timeoutMs)) : null;
      const finish = (error, exitCode, closeSignal) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        signal?.removeEventListener?.('abort', onAbort);
        this.active.delete(child);
        if (error) { reject(error); return; }
        const out = bounded(Buffer.concat(stdout), this.maxOutputBytes);
        const err = bounded(Buffer.concat(stderr), this.maxOutputBytes);
        resolve(Object.freeze({
          stdout: redact(out.text, secrets),
          stderr: redact(err.text, secrets),
          exitCode: Number.isInteger(exitCode) ? exitCode : null,
          signal: closeSignal ?? null,
          timedOut,
          cancelled: Boolean(signal?.aborted) && !timedOut,
          outputTruncated: out.truncated || err.truncated,
          mode,
          resourceUsage: Object.freeze({ outputBytes: out.bytes + err.bytes }),
        }));
      };
      child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
      child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
      child.on('error', (error) => finish(error));
      child.on('close', (code, closeSignal) => finish(null, code, closeSignal));
    });
  }

  async teardown() {
    for (const child of [...this.active]) {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
      this.active.delete(child);
    }
  }
}
