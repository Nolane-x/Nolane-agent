import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import readline from 'node:readline';

function rpcError(error, fallback = 'PTY host request failed') {
  const value = new Error(String(error?.message ?? fallback));
  value.code = error?.code ?? 'PTY_HOST_ERROR';
  value.data = error?.data;
  return value;
}

export class PtyHostClient extends EventEmitter {
  constructor({ command, args = [], cwd, env, requestTimeoutMs = 10_000, startupTimeoutMs, maxFrameBytes = 1024 * 1024, spawnImpl = spawn } = {}) {
    super();
    if (!command) throw new TypeError('PTY host command is required');
    this.command = command;
    this.args = [...args];
    this.cwd = cwd;
    this.env = env;
    this.requestTimeoutMs = Math.max(50, Number(requestTimeoutMs) || 10_000);
    this.startupTimeoutMs = Math.max(50, Number(startupTimeoutMs) || Math.max(this.requestTimeoutMs, 2_000));
    this.maxFrameBytes = Math.max(512, Number(maxFrameBytes) || 1024 * 1024);
    this.spawnImpl = spawnImpl;
    this.child = null;
    this.pending = new Map();
    this.sequence = 0;
    this.ready = null;
    this.closed = false;
    this.protocolFailure = null;
  }

  async start() {
    if (this.ready) return this.ready;
    if (this.closed) throw new Error('PTY host client is closed');
    this.ready = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        this.ready = null;
        reject(error);
      };
      try {
        this.child = this.spawnImpl(this.command, this.args, {
          cwd: this.cwd,
          env: this.env ?? process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (error) { fail(error); return; }
      const child = this.child;
      let stderr = '';
      child.stderr?.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-16_384); });
      child.stdin?.on('error', (error) => {
        this.#rejectPending(error);
        if (!this.closed) this.emit('stdin-error', error);
      });
      const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
      this.lines = lines;
      lines.on('line', (line) => {
        try { this.#handleLine(line); }
        catch (error) {
          this.protocolFailure = error;
          this.emit('protocol-error', error);
          fail(error);
          child.kill();
        }
      });
      child.once('error', fail);
      child.once('exit', (code, signal) => {
        const error = this.protocolFailure ?? new Error(`PTY host exited (${code ?? signal ?? 'unknown'})${stderr ? `: ${stderr.trim()}` : ''}`);
        this.#rejectPending(error);
        this.emit('exit', { code, signal, error });
        fail(error);
      });
      this.request('initialize', { protocolVersion: 1 }, { timeoutMs: this.startupTimeoutMs, skipStart: true }).then((result) => {
        if (Number(result?.protocolVersion) !== 1) throw new Error(`Unsupported PTY protocol version: ${result?.protocolVersion}`);
        if (!settled) { settled = true; resolve(result); }
      }, fail);
    });
    return this.ready;
  }

  #handleLine(line) {
    if (Buffer.byteLength(line) > this.maxFrameBytes) throw new Error(`PTY host frame exceeds ${this.maxFrameBytes} bytes`);
    let message;
    try { message = JSON.parse(line); } catch { throw new Error('PTY host emitted invalid JSON'); }
    if (message && Object.hasOwn(message, 'id')) {
      const pending = this.pending.get(String(message.id));
      if (!pending) return;
      this.pending.delete(String(message.id)); clearTimeout(pending.timer);
      if (message.error) pending.reject(rpcError(message.error)); else pending.resolve(message.result);
      return;
    }
    if (message?.method) {
      this.emit('notification', message);
      this.emit(message.method, message.params ?? {});
    }
  }

  async request(method, params = {}, { timeoutMs = this.requestTimeoutMs, signal, skipStart = false } = {}) {
    if (!skipStart) await this.start();
    if (!this.child?.stdin?.writable) throw new Error('PTY host is not running');
    if (signal?.aborted) throw signal.reason ?? new Error('PTY request aborted');
    const id = String(++this.sequence);
    const frame = `${JSON.stringify({ id, method, params })}\n`;
    if (Buffer.byteLength(frame) > this.maxFrameBytes) throw new Error(`PTY request frame exceeds ${this.maxFrameBytes} bytes`);
    return new Promise((resolve, reject) => {
      const finishAbort = () => {
        const pending = this.pending.get(id); if (!pending) return;
        this.pending.delete(id); clearTimeout(pending.timer);
        reject(signal.reason ?? new Error('PTY request aborted'));
      };
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`PTY request timed out: ${method}`));
      }, Math.max(1, Number(timeoutMs) || this.requestTimeoutMs));
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      signal?.addEventListener('abort', finishAbort, { once: true });
      this.child.stdin.write(frame, (error) => {
        if (!error) return;
        const pending = this.pending.get(id); if (!pending) return;
        this.pending.delete(id); clearTimeout(timer); reject(error);
      });
    });
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    const child = this.child;
    if (!child) return;
    const exited = child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise((resolve) => child.once('exit', resolve));
    try { if (child.stdin?.writable) await this.request('shutdown', {}, { timeoutMs: 250, skipStart: true }); } catch {}
    this.lines?.close();
    try { child.stdin?.end(); } catch {}
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 500))]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 500))]);
    }
    this.#rejectPending(new Error('PTY host client closed'));
    this.child = null;
  }
}
