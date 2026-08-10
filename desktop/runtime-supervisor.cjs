'use strict';

const { readFile, rm } = require('node:fs/promises');

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function validateRuntime(value) {
  if (!value || typeof value !== 'object') throw new Error('Runtime handoff must be an object');
  const url = new URL(String(value.url ?? ''));
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Runtime handoff URL must use loopback HTTP');
  const token = String(value.token ?? '');
  if (token.length < 2) throw new Error('Runtime handoff token is missing');
  return Object.freeze({ ...value, url: url.origin, token });
}

class RuntimeSupervisor {
  constructor({ processFactory, runtimeFile, modulePath, cwd = undefined, env = {}, startupTimeoutMs = 45_000, pollMs = 40, maxRestarts = 2, onUnexpectedExit = null } = {}) {
    if (typeof processFactory !== 'function') throw new TypeError('processFactory is required');
    if (!runtimeFile || !modulePath) throw new TypeError('runtimeFile and modulePath are required');
    this.processFactory = processFactory;
    this.runtimeFile = runtimeFile;
    this.modulePath = modulePath;
    this.cwd = cwd;
    this.env = { ...env };
    this.startupTimeoutMs = startupTimeoutMs;
    this.pollMs = pollMs;
    this.maxRestarts = maxRestarts;
    this.onUnexpectedExit = onUnexpectedExit;
    this.child = null;
    this.ready = false;
    this.stopping = false;
  }

  async #readRuntime() {
    try { return validateRuntime(JSON.parse(await readFile(this.runtimeFile, 'utf8'))); } catch { return null; }
  }

  async #spawnOnce() {
    await rm(this.runtimeFile, { force: true });
    let resolveExit;
    const exited = new Promise((resolve) => { resolveExit = resolve; });
    const child = this.processFactory({ modulePath: this.modulePath, cwd: this.cwd, env: { ...this.env } });
    this.child = child;
    let exitSeen = false;
    child.once('exit', (code) => {
      exitSeen = true;
      resolveExit({ code: Number(code ?? 0) });
      if (this.ready && !this.stopping) { this.ready = false; this.child = null; this.onUnexpectedExit?.({ code: Number(code ?? 0) }); }
    });
    const started = Date.now();
    while (Date.now() - started < this.startupTimeoutMs) {
      const runtime = await this.#readRuntime();
      if (runtime) { this.ready = true; return runtime; }
      if (exitSeen) return exited.then((info) => { throw Object.assign(new Error(`Nolane Agent runtime exited before readiness (${info.code})`), info); });
      await Promise.race([delay(this.pollMs), exited.then((info) => { throw Object.assign(new Error(`Nolane Agent runtime exited before readiness (${info.code})`), info); })]);
    }
    if (!exitSeen) child.kill?.();
    throw new Error(`Nolane Agent runtime handoff timed out after ${this.startupTimeoutMs}ms`);
  }

  async start() {
    if (this.child && this.ready) return this.#readRuntime();
    this.stopping = false;
    let lastError;
    for (let attempt = 0; attempt <= this.maxRestarts; attempt += 1) {
      this.ready = false;
      try { return await this.#spawnOnce(); } catch (error) { lastError = error; this.child = null; if (attempt < this.maxRestarts) await delay(Math.min(250 * (attempt + 1), 1_000)); }
    }
    throw lastError ?? new Error('Nolane Agent runtime failed to start');
  }

  async stop() {
    if (this.stopping) return;
    this.stopping = true;
    this.ready = false;
    const child = this.child;
    this.child = null;
    child?.kill?.();
    await rm(this.runtimeFile, { force: true }).catch(() => {});
  }
}

module.exports = Object.freeze({ RuntimeSupervisor, validateRuntime });
