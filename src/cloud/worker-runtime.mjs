export class WorkerRuntime {
  constructor({ queue, sandboxService, executor, heartbeatEveryMs = 10_000 } = {}) {
    if (!queue || !sandboxService || typeof executor !== 'function') throw new TypeError('queue, sandboxService and executor are required');
    this.queue = queue; this.sandboxService = sandboxService; this.executor = executor; this.heartbeatEveryMs = Math.max(100, heartbeatEveryMs);
  }
  async runOnce({ organizationId, workerId, leaseMs = 30_000 } = {}) {
    const lease = this.queue.lease({ organizationId, workerId, leaseMs });
    if (!lease) return Object.freeze({ state: 'idle' });
    const { job, fencingToken } = lease;
    let sandbox = null; let timer = null;
    try {
      sandbox = await this.sandboxService.create({ organizationId: job.organizationId, workspaceId: job.workspaceId, ...(job.payload.sandbox ?? {}) });
      timer = setInterval(() => { try { this.queue.heartbeat({ jobId: job.id, workerId, fencingToken, leaseMs }); } catch {} }, Math.min(this.heartbeatEveryMs, Math.max(100, Math.floor(leaseMs / 2))));
      timer.unref?.();
      const result = await this.executor({ job, sandbox, workerId, fencingToken });
      const completed = this.queue.complete({ jobId: job.id, workerId, fencingToken, result });
      return Object.freeze({ state: completed.state, job: completed, result: structuredClone(result) });
    } catch (error) {
      const failed = this.queue.fail({ jobId: job.id, workerId, fencingToken, retryable: error?.retryable !== false, error: { code: String(error?.code ?? 'worker-execution-failed'), message: String(error?.message ?? error).slice(0, 500) } });
      return Object.freeze({ state: failed.state, job: failed, error: failed.error });
    } finally {
      if (timer) clearInterval(timer);
      if (sandbox) await this.sandboxService.terminate({ organizationId: job.organizationId, sandboxId: sandbox.id, reason: 'worker-finished' }).catch(() => {});
    }
  }
}
