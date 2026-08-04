import { createHash, randomUUID } from 'node:crypto';

const PRIORITY = Object.freeze({ background: 100, watcher: 200, mission: 300, interactive: 400 });
const KNOWN_STAGES = Object.freeze(['lexical', 'semantic', 'graph']);

function clean(value, maximum = 512) {
  return String(value ?? '').trim().slice(0, maximum);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function frozen(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(frozen); return Object.freeze(value); }
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

function normalizeStages(stages, runners) {
  const requested = Array.isArray(stages) && stages.length ? stages : KNOWN_STAGES;
  const normalized = [...new Set(requested.map((stage) => clean(stage, 64)).filter(Boolean))];
  for (const stage of normalized) {
    if (!KNOWN_STAGES.includes(stage)) throw new TypeError(`Unknown repository intelligence stage: ${stage}`);
    if (typeof runners[stage] !== 'function') throw new TypeError(`Repository intelligence runner is not configured: ${stage}`);
  }
  return normalized;
}

function normalizePriority(priority) {
  const value = clean(priority || 'mission', 64);
  if (!(value in PRIORITY)) throw new TypeError(`Unknown repository intelligence priority: ${value}`);
  return value;
}

export class RepositoryIntelligenceScheduler {
  constructor({ governor, runners = {}, journal = null, maxWorkers = 2, maxJournal = 500, allowEssentialInEmergency = false, clock = () => Date.now(), eventSink = () => {} } = {}) {
    if (!governor?.snapshot) throw new TypeError('governor with snapshot() is required');
    this.governor = governor;
    this.runners = Object.freeze({ ...runners });
    if (journal !== null && typeof journal?.publish !== 'function') throw new TypeError('journal must expose publish()');
    this.incrementalJournal = journal;
    if (!Object.values(this.runners).some((runner) => typeof runner === 'function')) throw new TypeError('at least one repository intelligence runner is required');
    this.maxWorkers = Math.max(1, Math.min(32, Math.floor(Number(maxWorkers) || 2)));
    this.maxJournal = Math.max(1, Math.min(10_000, Math.floor(Number(maxJournal) || 500)));
    this.allowEssentialInEmergency = Boolean(allowEssentialInEmergency);
    this.clock = clock;
    this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.queue = [];
    this.activeJobs = new Map();
    this.activeProjects = new Set();
    this.jobsByKey = new Map();
    this.journal = [];
    this.sequence = 0;
    this.closed = false;
  }

  #policy() {
    const snapshot = this.governor.snapshot();
    const state = clean(snapshot?.state ?? 'unknown', 64);
    const semanticIndexing = clean(snapshot?.policy?.semanticIndexing ?? 'incremental', 64);
    const workers = state === 'emergency' && !this.allowEssentialInEmergency ? 0 : state === 'normal' ? this.maxWorkers : 1;
    return Object.freeze({ state, semanticIndexing, workers });
  }

  #emit(type, detail = {}) {
    const base = { schema: 'forge.repository-intelligence-scheduler-event.v1', type, atMs: this.clock(), ...detail };
    const event = frozen({ ...base, receiptSha256: sha256(base) });
    this.journal.push(event);
    if (this.journal.length > this.maxJournal) this.journal.splice(0, this.journal.length - this.maxJournal);
    try { void this.eventSink(event); } catch {}
    return event;
  }

  #key(projectId, generation, stages) {
    return `${projectId}:${generation}:${[...stages].sort().join(',')}`;
  }

  #removeQueued(job) {
    const index = this.queue.indexOf(job);
    if (index >= 0) this.queue.splice(index, 1);
    this.jobsByKey.delete(job.key);
    job.signal?.removeEventListener?.('abort', job.onAbort);
  }

  #rejectQueued(job, error, type, detail = {}) {
    this.#removeQueued(job);
    this.#emit(type, { jobId: job.id, projectId: job.project.id, generation: job.generation, priority: job.priority, ...detail });
    job.reject(error);
  }

  #cancelStaleQueued(projectId, generation) {
    for (const job of [...this.queue]) {
      if (job.project.id !== projectId || job.generation === generation) continue;
      this.#rejectQueued(job, fail('REPOSITORY_INDEX_STALE', `Repository index generation ${job.generation} was superseded by ${generation}`), 'repository-index.stale-cancelled', { supersededBy: generation });
    }
  }

  #sortQueue() {
    this.queue.sort((a, b) => PRIORITY[b.priority] - PRIORITY[a.priority] || a.sequence - b.sequence);
  }

  #nextRunnable() {
    this.#sortQueue();
    return this.queue.find((job) => !this.activeProjects.has(job.project.id)) ?? null;
  }

  #semanticSkipReason(priority, policy) {
    if (policy.semanticIndexing === 'suspended') return 'semantic-suspended';
    if (policy.semanticIndexing === 'on-demand' && !['interactive', 'mission'].includes(priority)) return 'semantic-on-demand';
    return null;
  }

  async #run(job) {
    const startedAtMs = this.clock();
    const policy = this.#policy();
    const outputs = {};
    const completedStages = [];
    const skippedStages = [];
    this.#emit('repository-index.started', { jobId: job.id, projectId: job.project.id, generation: job.generation, priority: job.priority, stages: job.stages, queueDelayMs: Math.max(0, startedAtMs - job.enqueuedAtMs), governorState: policy.state });
    try {
      for (const stage of job.stages) {
        if (job.controller.signal.aborted) throw job.controller.signal.reason ?? fail('REPOSITORY_INDEX_ABORTED', 'Repository indexing aborted');
        if (stage === 'semantic') {
          const reason = this.#semanticSkipReason(job.priority, this.#policy());
          if (reason) { skippedStages.push({ stage, reason }); continue; }
        }
        outputs[stage] = await this.runners[stage](job.project, Object.freeze({
          signal: job.controller.signal,
          generation: job.generation,
          priority: job.priority,
          reason: job.reason,
          deferEmbeddings: job.deferEmbeddings,
          jobId: job.id,
          journalCursors: job.journalCursors,
          branchContext: job.branchContext,
        }));
        completedStages.push(stage);
      }
      const completedAtMs = this.clock();
      const baseResult = {
        schema: 'forge.repository-intelligence-job-result.v1',
        jobId: job.id,
        projectId: job.project.id,
        generation: job.generation,
        priority: job.priority,
        state: 'completed',
        completedStages,
        skippedStages,
        journalCursors: job.journalCursors,
        outputs,
        enqueuedAtMs: job.enqueuedAtMs,
        startedAtMs,
        completedAtMs,
        queueDelayMs: Math.max(0, startedAtMs - job.enqueuedAtMs),
        durationMs: Math.max(0, completedAtMs - startedAtMs),
      };
      const result = frozen({ ...baseResult, receiptSha256: sha256(baseResult) });
      this.#emit('repository-index.completed', { jobId: job.id, projectId: job.project.id, generation: job.generation, priority: job.priority, completedStages, skippedStages, durationMs: result.durationMs, resultReceiptSha256: result.receiptSha256 });
      job.resolve(result);
    } catch (error) {
      const code = clean(error?.code ?? (job.controller.signal.aborted ? 'REPOSITORY_INDEX_ABORTED' : 'REPOSITORY_INDEX_FAILED'), 128);
      this.#emit('repository-index.failed', { jobId: job.id, projectId: job.project.id, generation: job.generation, priority: job.priority, code, error: clean(error?.message ?? error, 2_000) });
      job.reject(error);
    } finally {
      job.signal?.removeEventListener?.('abort', job.onAbort);
      this.activeJobs.delete(job.id);
      this.activeProjects.delete(job.project.id);
      this.jobsByKey.delete(job.key);
      this.#drain();
    }
  }

  #drain() {
    if (this.closed) return;
    const policy = this.#policy();
    while (this.activeJobs.size < policy.workers) {
      const job = this.#nextRunnable();
      if (!job) break;
      const index = this.queue.indexOf(job);
      this.queue.splice(index, 1);
      job.signal?.removeEventListener?.('abort', job.onAbort);
      this.activeJobs.set(job.id, job);
      this.activeProjects.add(job.project.id);
      void this.#run(job);
    }
  }

  enqueue({ project, generation = 'current', priority = 'mission', stages = null, reason = null, signal = null, deferEmbeddings = false, branchContext = null, changes = [] } = {}) {
    if (this.closed) return Promise.reject(fail('REPOSITORY_INDEX_SCHEDULER_CLOSED', 'Repository intelligence scheduler is closed'));
    if (!project?.id) return Promise.reject(new TypeError('project is required'));
    const policy = this.#policy();
    if (policy.workers <= 0) return Promise.reject(fail('REPOSITORY_INDEX_ADMISSION_BLOCKED', `Repository indexing admission blocked in ${policy.state} state`));
    const normalizedGeneration = clean(generation, 512) || 'current';
    const normalizedPriority = normalizePriority(priority);
    let normalizedStages;
    try { normalizedStages = normalizeStages(stages, this.runners); }
    catch (error) { return Promise.reject(error); }
    const projectId = clean(project.id, 512);
    const journalCursors = [];
    if (this.incrementalJournal && Array.isArray(changes)) {
      const seen = new Set();
      for (const change of changes) {
        const normalizedPath = clean(change?.path, 2_000).replaceAll('\\', '/').replace(/^\.\//, '');
        const contentHash = clean(change?.contentHash ?? change?.sha256, 512);
        if (!normalizedPath || !contentHash) continue;
        const dedupe = `${normalizedPath}:${contentHash}:${normalizedGeneration}:${clean(change?.kind ?? 'modify', 64)}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        journalCursors.push(this.incrementalJournal.publish({ projectId, path: normalizedPath, contentHash, generation: normalizedGeneration, kind: change?.kind ?? 'modify', priority: normalizedPriority, metadata: change?.metadata ?? {} }).cursor);
      }
    }
    const key = this.#key(projectId, normalizedGeneration, normalizedStages);
    const existing = this.jobsByKey.get(key);
    if (existing) {
      this.#emit('repository-index.coalesced', { jobId: existing.id, projectId, generation: normalizedGeneration, priority: normalizedPriority, stages: normalizedStages });
      return existing.promise;
    }
    if (signal?.aborted) return Promise.reject(signal.reason ?? fail('REPOSITORY_INDEX_ABORTED', 'Repository indexing aborted'));
    this.#cancelStaleQueued(projectId, normalizedGeneration);
    const controller = new AbortController();
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const job = {
      id: randomUUID(), key, project, generation: normalizedGeneration, priority: normalizedPriority, stages: normalizedStages,
      reason: clean(reason, 1_000) || null, deferEmbeddings: Boolean(deferEmbeddings), branchContext: branchContext && typeof branchContext === 'object' ? Object.freeze({ branch: branchContext.branch == null ? null : String(branchContext.branch), headSha: branchContext.headSha == null ? null : String(branchContext.headSha), dirtyHash: branchContext.dirtyHash == null ? null : String(branchContext.dirtyHash) }) : null, signal, controller,
      sequence: ++this.sequence, enqueuedAtMs: this.clock(), journalCursors: Object.freeze([...journalCursors]), promise, resolve, reject, onAbort: null,
    };
    job.onAbort = () => {
      if (this.activeJobs.has(job.id)) controller.abort(signal?.reason ?? fail('REPOSITORY_INDEX_ABORTED', 'Repository indexing aborted'));
      else this.#rejectQueued(job, signal?.reason ?? fail('REPOSITORY_INDEX_ABORTED', 'Repository indexing aborted'), 'repository-index.cancelled', { reason: clean(signal?.reason?.message ?? signal?.reason ?? 'aborted', 1_000) });
    };
    signal?.addEventListener?.('abort', job.onAbort, { once: true });
    this.queue.push(job);
    this.jobsByKey.set(key, job);
    this.#emit('repository-index.queued', { jobId: job.id, projectId, generation: normalizedGeneration, priority: normalizedPriority, stages: normalizedStages, queued: this.queue.length, active: this.activeJobs.size, governorState: policy.state });
    this.#drain();
    return promise;
  }

  cancelProject(projectId, reason = 'project indexing cancelled') {
    const key = clean(projectId, 512);
    let cancelled = 0;
    for (const job of [...this.queue]) {
      if (job.project.id !== key) continue;
      cancelled += 1;
      this.#rejectQueued(job, fail('REPOSITORY_INDEX_ABORTED', reason), 'repository-index.cancelled', { reason: clean(reason, 1_000) });
    }
    for (const job of this.activeJobs.values()) {
      if (job.project.id !== key) continue;
      cancelled += 1;
      job.controller.abort(fail('REPOSITORY_INDEX_ABORTED', reason));
    }
    return frozen({ schema: 'forge.repository-intelligence-cancellation.v1', projectId: key, cancelled });
  }

  snapshot(projectId = null) {
    const filter = projectId == null ? null : clean(projectId, 512);
    const activeJobs = [...this.activeJobs.values()].filter((job) => !filter || job.project.id === filter).map((job) => ({ jobId: job.id, projectId: job.project.id, generation: job.generation, priority: job.priority, stages: [...job.stages], started: true }));
    const queuedJobs = this.queue.filter((job) => !filter || job.project.id === filter).map((job) => ({ jobId: job.id, projectId: job.project.id, generation: job.generation, priority: job.priority, stages: [...job.stages], enqueuedAtMs: job.enqueuedAtMs }));
    const journal = this.journal.filter((entry) => !filter || entry.projectId === filter);
    const policy = this.#policy();
    return frozen({ schema: 'forge.repository-intelligence-scheduler-snapshot.v1', state: policy.state, semanticIndexing: policy.semanticIndexing, workers: policy.workers, maxWorkers: this.maxWorkers, active: activeJobs.length, queued: queuedJobs.length, activeJobs, queuedJobs, journal, closed: this.closed });
  }

  close() {
    if (this.closed) return this.snapshot();
    this.closed = true;
    const error = fail('REPOSITORY_INDEX_SCHEDULER_CLOSED', 'Repository intelligence scheduler is closed');
    for (const job of [...this.queue]) this.#rejectQueued(job, error, 'repository-index.scheduler-closed');
    for (const job of this.activeJobs.values()) job.controller.abort(error);
    this.#emit('repository-index.scheduler-closed', { active: this.activeJobs.size });
    return this.snapshot();
  }
}
