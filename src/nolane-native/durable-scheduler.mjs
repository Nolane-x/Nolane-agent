import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const activeStatus = new Set(['scheduled', 'running', 'paused']);

export class NolaneDurableScheduler {
  constructor({ file, clock = () => Date.now() } = {}) { if (!file) throw new Error('scheduler file is required'); this.file = path.resolve(file); this.clock = clock; this.jobs = new Map(); this.chain = Promise.resolve(); }
  async open() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')); if (!['nolane.agent.scheduler.v1', 'nolane.agent.scheduler.v2'].includes(data.schema)) throw new Error('invalid scheduler schema');
      for (const item of data.jobs ?? []) this.jobs.set(item.id, { retryFingerprint: item.retryFingerprint ?? item.id, leaseTtlMs: item.leaseTtlMs ?? 60_000, leaseExpiresAt: item.leaseExpiresAt ?? null, attempts: item.attempts ?? 0, maxAttempts: item.maxAttempts ?? 1, retryDelayMs: item.retryDelayMs ?? 0, ...item });
    } catch (error) { if (error.code !== 'ENOENT') throw error; await this.#persist(); }
    const recoveredStale = await this.recoverStale();
    return { jobs: this.jobs.size, recoveredStale: recoveredStale.length };
  }
  async schedule({ id, runAt, task, retryFingerprint = id, leaseTtlMs = 60_000, maxAttempts = 1, retryDelayMs = 0 }) {
    if (!id || !Number.isFinite(runAt) || !task?.type) throw new Error('job id, runAt and typed task are required'); if (this.jobs.has(id)) throw new Error(`job already exists: ${id}`);
    if ([...this.jobs.values()].some((job) => activeStatus.has(job.status) && job.retryFingerprint === retryFingerprint)) throw new Error(`duplicate retry fingerprint: ${retryFingerprint}`);
    const job = { id, runAt, task: structuredClone(task), retryFingerprint: String(retryFingerprint), leaseTtlMs: Math.max(1, Number(leaseTtlMs) || 60_000), leaseExpiresAt: null, attempts: 0, maxAttempts: Math.max(1, Number(maxAttempts) || 1), retryDelayMs: Math.max(0, Number(retryDelayMs) || 0), status: 'scheduled', createdAt: this.clock(), startedAt: null, completedAt: null, resultReceiptSha256: null };
    this.jobs.set(id, job); await this.#persist(); return structuredClone(job);
  }
  get(id) { const job = this.jobs.get(id); return job ? structuredClone(job) : null; }
  snapshot() { return Object.freeze({ jobs: this.jobs.size, scheduled: [...this.jobs.values()].filter((job) => job.status === 'scheduled').length, running: [...this.jobs.values()].filter((job) => job.status === 'running').length, paused: [...this.jobs.values()].filter((job) => job.status === 'paused').length }); }
  async pause(id) { const job = this.#require(id); if (job.status !== 'scheduled') throw new Error(`job is not scheduled: ${id}`); job.status = 'paused'; await this.#persist(); return this.get(id); }
  async resume(id) { const job = this.#require(id); if (job.status !== 'paused') throw new Error(`job is not paused: ${id}`); job.status = 'scheduled'; await this.#persist(); return this.get(id); }
  async recoverStale() {
    const recovered = [];
    for (const job of this.jobs.values()) {
      if (job.status !== 'running' || job.leaseExpiresAt === null || job.leaseExpiresAt > this.clock()) continue;
      job.status = job.attempts < job.maxAttempts ? 'scheduled' : 'failed'; job.runAt = this.clock() + job.retryDelayMs; job.leaseExpiresAt = null; job.errorCode = sha256('stale-lease'); recovered.push(job.id);
    }
    if (recovered.length) await this.#persist();
    return Object.freeze(recovered.sort());
  }
  async runDue(executor) {
    if (typeof executor !== 'function') throw new Error('scheduler executor is required');
    const results = [];
    for (const job of [...this.jobs.values()].filter((item) => item.status === 'scheduled' && item.runAt <= this.clock()).sort((a, b) => a.runAt - b.runAt || a.id.localeCompare(b.id))) {
      job.status = 'running'; job.startedAt = this.clock(); job.attempts += 1; job.leaseExpiresAt = this.clock() + job.leaseTtlMs; await this.#persist();
      try {
        const result = await executor(structuredClone(job));
        if (!/^[a-f0-9]{64}$/.test(result?.receiptSha256 ?? '')) throw new Error('scheduled job requires a result receipt');
        job.status = 'completed'; job.completedAt = this.clock(); job.leaseExpiresAt = null; job.resultReceiptSha256 = result.receiptSha256; await this.#persist();
        results.push(Object.freeze({ id: job.id, status: job.status, receiptSha256: result.receiptSha256 }));
      } catch (error) {
        job.completedAt = this.clock(); job.leaseExpiresAt = null; job.errorCode = sha256(String(error?.message ?? error));
        if (job.attempts < job.maxAttempts) { job.status = 'scheduled'; job.runAt = this.clock() + job.retryDelayMs; } else job.status = 'failed';
        await this.#persist(); throw error;
      }
    }
    return Object.freeze(results);
  }
  #require(id) { const job = this.jobs.get(String(id)); if (!job) throw new Error(`unknown job: ${id}`); return job; }
  async #persist() { const payload = { schema: 'nolane.agent.scheduler.v2', jobs: [...this.jobs.values()].sort((a, b) => a.id.localeCompare(b.id)) }; const temp = `${this.file}.tmp-${process.pid}-${Date.now()}`; await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 }); await rename(temp, this.file); }
}
