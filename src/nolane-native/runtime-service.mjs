import { Worker } from 'node:worker_threads';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { RuntimeReceiptLedger } from '../native-core/runtime-receipt-ledger.mjs';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export class NolaneNativeRuntimeService {
  constructor({ projectRoot, requestTimeoutMs = 5_000, clock = () => Date.now() } = {}) {
    if (!projectRoot) throw new TypeError('projectRoot is required');
    this.projectRoot = path.resolve(projectRoot);
    this.requestTimeoutMs = requestTimeoutMs;
    this.worker = null;
    this.state = 'stopped';
    this.nextId = 1;
    this.pending = new Map();
    this.manifest = null;
    this.clock = clock;
    this.lifecycle = new RuntimeReceiptLedger({ streamId: `runtime:${this.projectRoot}`, clock });
  }

  async preflight() {
    const manifestPath = path.join(this.projectRoot, 'config', 'nolane-native-runtime.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.schema !== 'nolane.agent.native-runtime.v1') throw new Error('unsupported runtime manifest schema');
    if (manifest.protocol !== 'nolane-agent-runtime/1') throw new Error('unsupported runtime protocol');

    const workerPath = this.#resolveInsideRoot(manifest.worker);
    const lockPath = this.#resolveInsideRoot(manifest.dependencyLock);
    const [workerBytes, lockBytes] = await Promise.all([readFile(workerPath), readFile(lockPath)]);
    if (sha256(workerBytes) !== manifest.workerSha256) throw new Error('worker sha256 mismatch');
    if (lockBytes.length === 0) throw new Error('offline dependency lock is empty');
    const lock = JSON.parse(lockBytes.toString('utf8'));
    if (!lock.lockfileVersion || !lock.packages) throw new Error('offline dependency lock is invalid');
    const workerInfo = await stat(workerPath);
    if (!workerInfo.isFile()) throw new Error('runtime worker is not a file');

    this.manifest = { ...manifest, workerPath, lockPath, lockSha256: sha256(lockBytes) };
    this.lifecycle.append({ type: 'preflight', payload: { protocol: manifest.protocol, workerSha256: manifest.workerSha256, dependencyLockSha256: this.manifest.lockSha256 } });
    return {
      ready: true,
      protocol: manifest.protocol,
      workerSha256: manifest.workerSha256,
      dependencyLockSha256: this.manifest.lockSha256,
      capabilities: [...(manifest.capabilities ?? [])]
    };
  }

  async start() {
    if (this.worker) return this.status();
    const preflight = await this.preflight();
    this.state = 'starting';
    this.lifecycle.append({ type: 'starting', payload: { protocol: preflight.protocol } });
    const worker = new Worker(pathToFileURL(this.manifest.workerPath), { type: 'module' });
    this.worker = worker;
    worker.on('message', (message) => this.#onMessage(message));
    worker.on('error', (error) => this.#failPending(error));
    worker.on('exit', (code) => {
      const wasStopping = this.state === 'stopping';
      this.worker = null;
      this.state = 'stopped';
      if (!wasStopping && code !== 0) this.#failPending(new Error(`native runtime exited with code ${code}`));
    });
    try {
      const handshake = await this.#request('handshake');
      if (handshake.protocol !== preflight.protocol) throw new Error('runtime protocol handshake mismatch');
      this.lifecycle.append({ type: 'handshake', payload: { protocol: handshake.protocol } });
      this.state = 'running';
      this.lifecycle.append({ type: 'running', payload: { protocol: handshake.protocol } });
      return this.status();
    } catch (error) {
      await worker.terminate().catch(() => {});
      this.worker = null;
      this.state = 'stopped';
      throw error;
    }
  }

  async ping() {
    if (this.state !== 'running') throw new Error('native runtime is not running');
    const result = await this.#request('ping');
    this.lifecycle.append({ type: 'ping', payload: { pong: Boolean(result.pong) } });
    return result;
  }

  async stop() {
    if (!this.worker) {
      this.state = 'stopped';
      return this.status();
    }
    this.state = 'stopping';
    this.lifecycle.append({ type: 'stopping', payload: {} });
    const worker = this.worker;
    try {
      await this.#request('shutdown');
    } catch {}
    await worker.terminate().catch(() => {});
    this.worker = null;
    this.state = 'stopped';
    this.lifecycle.append({ type: 'stopped', payload: {} });
    return this.status();
  }

  status() {
    return {
      status: this.state,
      protocol: this.manifest?.protocol ?? null,
      workerSha256: this.manifest?.workerSha256 ?? null,
      lifecycleReceipt: this.lifecycle.snapshot()
    };
  }

  #resolveInsideRoot(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath) throw new Error('runtime manifest path is required');
    const resolved = path.resolve(this.projectRoot, relativePath);
    const relative = path.relative(this.projectRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('runtime manifest path escapes project root');
    return resolved;
  }

  #request(type) {
    if (!this.worker) return Promise.reject(new Error('native runtime is not running'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`native runtime request timed out: ${type}`));
      }, this.requestTimeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type });
    });
  }

  #onMessage(message) {
    const pending = this.pending.get(message?.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.ok === false) pending.reject(new Error(message.error || 'native runtime request failed'));
    else pending.resolve(message);
  }

  #failPending(error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }
}
