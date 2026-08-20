import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import readline from 'node:readline';

export class JsonlRpcProcess extends EventEmitter {
  constructor({ executable, args = [], cwd = null, env = {}, inheritEnvironment = false, timeoutMs = 30_000, includeJsonrpc = true, requestHandler = null } = {}) {
    super();
    if (!String(executable ?? '').trim()) throw new TypeError('executable is required');
    if (!Array.isArray(args) || args.some((item) => typeof item !== 'string')) throw new TypeError('args must be strings');
    this.executable = String(executable); this.args = [...args]; this.cwd = cwd; this.env = { ...env }; this.inheritEnvironment = inheritEnvironment === true;
    this.timeoutMs = Math.max(10, Number(timeoutMs) || 30_000); this.includeJsonrpc = Boolean(includeJsonrpc); this.requestHandler = requestHandler;
    this.child = null; this.state = 'idle'; this.nextId = 1; this.pending = new Map(); this.stderr = '';
  }

  async start() {
    if (this.state === 'running') return this;
    if (this.state !== 'idle') throw new Error(`Cannot start JSON-RPC process in state ${this.state}`);
    this.state = 'starting';
    const env = this.inheritEnvironment ? { ...process.env, ...this.env } : { ...this.env };
    const child = spawn(this.executable, this.args, { cwd: this.cwd ?? undefined, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    this.child = child;
    child.stderr.on('data', (chunk) => { this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-64_000); this.emit('stderr', chunk.toString('utf8')); });
    const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => this.#onLine(line));
    child.once('error', (error) => this.#terminate(error));
    child.once('close', (code, signal) => this.#terminate(new Error(`JSON-RPC process exited with ${code ?? signal ?? 'unknown'}`)));
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    this.state = 'running';
    return this;
  }

  send(message) {
    if (this.state !== 'running' || !this.child?.stdin.writable) throw new Error('JSON-RPC process is not running');
    const payload = this.includeJsonrpc && !Object.hasOwn(message, 'jsonrpc') ? { jsonrpc: '2.0', ...message } : message;
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  notify(method, params = {}) { this.send({ method, params }); }

  async request(method, params = {}, { timeoutMs = this.timeoutMs, signal = null } = {}) {
    if (this.state === 'idle') await this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const finish = (fn, value) => {
        const pending = this.pending.get(id); if (!pending) return;
        clearTimeout(pending.timer); signal?.removeEventListener?.('abort', pending.abort); this.pending.delete(id); fn(value);
      };
      const abort = () => {
        try { this.notify('notifications/cancelled', { requestId: id, reason: String(signal?.reason ?? 'cancelled') }); } catch {}
        finish(reject, new Error(`JSON-RPC request cancelled: ${method}`));
      };
      const timer = setTimeout(() => {
        try { this.notify('notifications/cancelled', { requestId: id, reason: 'timeout' }); } catch {}
        finish(reject, new Error(`JSON-RPC request timed out: ${method}`));
      }, Math.max(10, Number(timeoutMs) || this.timeoutMs));
      timer.unref?.();
      this.pending.set(id, { resolve: (value) => finish(resolve, value), reject: (error) => finish(reject, error), timer, abort, method });
      if (signal?.aborted) abort(); else signal?.addEventListener?.('abort', abort, { once: true });
      try { this.send({ id, method, params }); } catch (error) { finish(reject, error); }
    });
  }

  async close() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    const child = this.child;
    if (child) {
      try { child.stdin.end(); } catch {}
      const closed = new Promise((resolve) => child.once('close', resolve));
      const timer = setTimeout(() => this.#kill(), 250); timer.unref?.();
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 500))]);
      clearTimeout(timer);
      this.#kill();
    }
    this.#terminate(new Error('JSON-RPC process closed'));
    this.state = 'closed';
  }

  #kill() {
    const child = this.child; if (!child || child.killed) return;
    try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
  }

  async #onLine(line) {
    let message; try { message = JSON.parse(line); } catch { this.emit('protocolError', new Error(`Invalid JSON-RPC line: ${line.slice(0, 200)}`)); return; }
    if (Object.hasOwn(message, 'id') && (Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error'))) {
      const pending = this.pending.get(message.id); if (!pending) return;
      if (message.error) {
        const error = new Error(String(message.error.message ?? 'JSON-RPC error')); error.code = message.error.code; error.data = message.error.data; pending.reject(error);
      } else pending.resolve(message.result);
      return;
    }
    if (Object.hasOwn(message, 'id') && message.method) {
      try {
        if (typeof this.requestHandler !== 'function') throw Object.assign(new Error(`Unhandled server request: ${message.method}`), { code: -32601 });
        const result = await this.requestHandler(message.method, message.params ?? {}, message);
        this.send({ id: message.id, result: result ?? {} });
      } catch (error) { this.send({ id: message.id, error: { code: Number(error.code) || -32000, message: String(error.message ?? error) } }); }
      return;
    }
    if (message.method) this.emit('notification', message);
  }

  #terminate(error) {
    if (this.state !== 'closed') this.state = 'closed';
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.emit('closed', error);
  }
}
