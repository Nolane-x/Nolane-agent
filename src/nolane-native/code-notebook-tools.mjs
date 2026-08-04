import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export class NativeNotebookService {
  #sessions = new Map();
  #timeoutMs;
  #maxOutputBytes;
  #maxSessions;
  #nextRequest = 1;

  constructor({ timeoutMs = 1_000, maxOutputBytes = 100_000, maxSessions = 4, maxOldGenerationSizeMb = 32 } = {}) {
    this.#timeoutMs = Math.max(10, Number(timeoutMs) || 1_000);
    this.#maxOutputBytes = Math.max(16, Number(maxOutputBytes) || 100_000);
    this.#maxSessions = Math.max(1, Number(maxSessions) || 4);
    this.maxOldGenerationSizeMb = Math.max(8, Number(maxOldGenerationSizeMb) || 32);
  }

  async openSession({ id } = {}) {
    const sessionId = String(id ?? `notebook-${this.#sessions.size + 1}`);
    if (!sessionId || this.#sessions.has(sessionId)) throw new Error(`Notebook session already exists: ${sessionId}`);
    if (this.#sessions.size >= this.#maxSessions) throw new Error(`Notebook session budget exhausted: ${this.#maxSessions}`);
    const worker = new Worker(new URL('./code-notebook-worker.mjs', import.meta.url), { type: 'module', resourceLimits: { maxOldGenerationSizeMb: this.maxOldGenerationSizeMb, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 } });
    const pending = new Map();
    worker.on('message', (message) => {
      const request = pending.get(message?.id); if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id);
      if (message.ok) request.resolve(message); else request.reject(new Error(message.error || 'Notebook execution failed'));
    });
    worker.on('error', (error) => { for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); } pending.clear(); });
    this.#sessions.set(sessionId, { worker, pending, cells: 0 });
    return Object.freeze({ id: sessionId, status: 'open', runtime: 'worker-vm', hostGlobalsExposed: false });
  }

  async executeCell({ sessionId, source, input = {} } = {}) {
    const session = this.#sessions.get(String(sessionId));
    if (!session) throw new Error(`Unknown notebook session: ${sessionId}`);
    if (typeof source !== 'string' || !source.trim() || source.length > 200_000) throw new TypeError('Notebook source must be non-empty bounded text');
    const id = this.#nextRequest++;
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { session.pending.delete(id); reject(new Error(`Notebook execution timed out after ${this.#timeoutMs}ms`)); }, this.#timeoutMs + 100);
      timer.unref?.();
      session.pending.set(id, { resolve, reject, timer });
      session.worker.postMessage({ id, source, input: structuredClone(input), timeoutMs: this.#timeoutMs, maxOutputBytes: this.#maxOutputBytes });
    });
    session.cells += 1;
    const base = { schema: 'nolane.native.notebook-cell.v1', sessionId: String(sessionId), cell: session.cells, sourceSha256: sha256(source), result: response.result, logs: response.logs, outputBytes: response.outputBytes, isolatedWorker: true, hostGlobalsExposed: false };
    return Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) });
  }

  async closeSession(sessionId) {
    const key = String(sessionId); const session = this.#sessions.get(key);
    if (!session) return Object.freeze({ id: key, closed: false });
    await session.worker.terminate(); this.#sessions.delete(key);
    return Object.freeze({ id: key, closed: true });
  }

  async closeAll() { for (const id of [...this.#sessions.keys()]) await this.closeSession(id); }
  snapshot() { return Object.freeze({ schema: 'nolane.native.notebook-service.v1', sessions: this.#sessions.size, timeoutMs: this.#timeoutMs, maxOutputBytes: this.#maxOutputBytes }); }
}
