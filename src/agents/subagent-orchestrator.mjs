import { createHash, randomUUID } from 'node:crypto';
import { validateAgentProfile } from './agent-profile-loader.mjs';

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function intersect(preferred, authority) {
  const allowed = new Set((authority ?? []).map(String));
  return [...new Set((preferred ?? []).map(String))].filter((value) => allowed.has(value));
}

function frozen(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(frozen); return Object.freeze(value); }
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

class Semaphore {
  constructor(limit) { this.limit = limit; this.active = 0; this.waiters = []; }
  async acquire(signal) {
    if (signal?.aborted) throw signal.reason ?? new Error('aborted');
    if (this.active < this.limit) { this.active += 1; return () => this.release(); }
    return await new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      const onAbort = () => { this.waiters = this.waiters.filter((item) => item !== waiter); reject(signal.reason ?? new Error('aborted')); };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      waiter.resolve = () => { if (signal) signal.removeEventListener('abort', onAbort); this.active += 1; resolve(() => this.release()); };
      this.waiters.push(waiter);
    });
  }
  release() { this.active = Math.max(0, this.active - 1); this.waiters.shift()?.resolve(); }
}

class ExclusiveLeaseSet {
  constructor() { this.locks = new Map(); }
  async acquire(names, signal) {
    const releases = [];
    for (const name of [...new Set(names)].sort()) {
      let semaphore = this.locks.get(name);
      if (!semaphore) { semaphore = new Semaphore(1); this.locks.set(name, semaphore); }
      releases.push(await semaphore.acquire(signal));
    }
    return () => { for (const release of releases.reverse()) release(); };
  }
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function normalizeOwnedPath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+/g, '/').slice(0, 2_000);
}

function normalizeAdaptiveJob(raw, profiles) {
  const id = String(raw?.id ?? '').trim().slice(0, 256);
  if (!id) fail('SUBAGENT_GRAPH_INVALID', 'Adaptive graph job id is required');
  const profileId = String(raw?.profileId ?? '').trim().slice(0, 256);
  if (!profiles.has(profileId)) fail('SUBAGENT_PROFILE_NOT_FOUND', `Unknown profile: ${profileId}`);
  const objective = String(raw?.objective ?? '').trim().slice(0, 20_000);
  if (!objective) fail('SUBAGENT_GRAPH_INVALID', `Objective is required for ${id}`);
  return {
    id,
    profileId,
    objective,
    dependencies: [...new Set((raw?.dependencies ?? []).map((item) => String(item).trim()).filter(Boolean))],
    ownedPaths: [...new Set((raw?.ownedPaths ?? []).map(normalizeOwnedPath).filter(Boolean))].sort(),
    ownedSymbols: [...new Set((raw?.ownedSymbols ?? []).map((item) => String(item).trim().slice(0, 1_000)).filter(Boolean))].sort(),
    confidence: boundedNumber(raw?.confidence, 1, 0, 1),
    expectedInformationGain: boundedNumber(raw?.expectedInformationGain, 1, 0, 1),
    maxAttempts: Math.floor(boundedNumber(raw?.maxAttempts, 1, 1, 8)),
    stopConditions: [...new Set((raw?.stopConditions ?? []).map((item) => String(item).trim().slice(0, 1_000)).filter(Boolean))],
    attempts: Math.max(0, Math.floor(Number(raw?.attempts) || 0)),
  };
}

function validateAdaptiveGraph(jobs, completedIds = new Set(), stoppedIds = new Set()) {
  const known = new Set([...jobs.keys(), ...completedIds, ...stoppedIds]);
  for (const job of jobs.values()) {
    for (const dependency of job.dependencies) if (!known.has(dependency)) fail('SUBAGENT_GRAPH_INVALID', `Unknown dependency ${dependency} for ${job.id}`);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (completedIds.has(id) || stoppedIds.has(id) || visited.has(id)) return;
    if (visiting.has(id)) fail('SUBAGENT_GRAPH_CYCLE', 'Subagent dependency graph contains a cycle');
    const job = jobs.get(id);
    if (!job) return;
    visiting.add(id);
    for (const dependency of job.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of jobs.keys()) visit(id);
}

function pathsConflict(a, b) {
  if (a === b) return true;
  const left = a.endsWith('/') ? a : `${a}/`;
  const right = b.endsWith('/') ? b : `${b}/`;
  return left.startsWith(right) || right.startsWith(left);
}

function ownershipConflict(left, right) {
  for (const path of left.ownedPaths) for (const candidate of right.ownedPaths) if (pathsConflict(path, candidate)) return { kind: 'path', value: path === candidate ? path : `${path}|${candidate}` };
  const symbols = new Set(left.ownedSymbols);
  for (const symbol of right.ownedSymbols) if (symbols.has(symbol)) return { kind: 'symbol', value: symbol };
  return null;
}

function publicJob(job) {
  return frozen({
    id: job.id, profileId: job.profileId, objective: job.objective, dependencies: [...job.dependencies], ownedPaths: [...job.ownedPaths], ownedSymbols: [...job.ownedSymbols],
    confidence: job.confidence, expectedInformationGain: job.expectedInformationGain, maxAttempts: job.maxAttempts, attempts: job.attempts, stopConditions: [...job.stopConditions],
  });
}

export class SubagentOrchestrator {
  constructor({ profiles = [], runner, eventSink = () => {}, signer = null, resultValidator = null, maxConcurrency = 4, governor = null } = {}) {
    if (typeof runner !== 'function') fail('SUBAGENT_RUNNER_REQUIRED', 'runner must be a function');
    this.profiles = new Map();
    for (const raw of profiles) {
      const profile = validateAgentProfile(raw, { source: raw.source ?? '<memory>' });
      if (this.profiles.has(profile.id)) fail('AGENT_PROFILE_DUPLICATE', `Duplicate agent profile id: ${profile.id}`);
      this.profiles.set(profile.id, profile);
    }
    this.runner = runner;
    this.eventSink = eventSink;
    this.signer = signer;
    this.resultValidator = typeof resultValidator === 'function' ? resultValidator : null;
    this.maxConcurrency = Math.max(1, Math.min(64, Number(maxConcurrency) || 4));
    this.governor = governor?.snapshot ? governor : null;
    this.global = new Semaphore(this.maxConcurrency);
    this.exclusive = new ExclusiveLeaseSet();
  }

  listProfiles() { return Object.freeze([...this.profiles.values()]); }

  async emit(type, detail) {
    const base = { schema: 'forge.subagent.event.v1', type, at: new Date().toISOString(), ...detail };
    const event = frozen({ ...base, receiptSha256: digest(base) });
    await this.eventSink(event);
    return event;
  }

  adaptiveConcurrency() {
    const configured = Number(this.governor?.snapshot?.()?.policy?.maxActiveAgents);
    if (!Number.isFinite(configured)) return this.maxConcurrency;
    return Math.max(0, Math.min(this.maxConcurrency, Math.floor(configured)));
  }

  buildChild({ parentTask, profile, profileId, objective, jobId }) {
    if (!parentTask?.permissions?.includes('agent.create')) fail('SUBAGENT_PERMISSION_DENIED', `Task ${parentTask?.id ?? '<unknown>'} cannot create child agents`);
    const regularTools = intersect(profile.tools, parentTask.allowedTools);
    const exclusiveTools = intersect(profile.exclusiveTools, parentTask.allowedTools);
    return frozen({
      schema: 'forge.subagent-task.v1', id: randomUUID(), jobId: jobId ?? randomUUID(), parentTaskId: String(parentTask.id), projectId: String(parentTask.projectId ?? ''),
      profileId, objective: String(objective ?? '').trim().slice(0, 20_000), prompt: profile.prompt,
      allowedTools: [...regularTools, ...exclusiveTools], exclusiveTools,
      mcpServers: intersect(profile.mcpServers, parentTask.allowedMcpServers), skills: intersect(profile.skills, parentTask.allowedSkills),
      capabilities: [...profile.capabilities], maxTurns: Math.min(profile.maxTurns, Number(parentTask.maxTurns ?? profile.maxTurns)),
      budgetTokens: Math.min(profile.budgetTokens, Number(parentTask.budgetTokens ?? profile.budgetTokens)), sandboxProfile: profile.sandboxProfile,
      canCreateChildren: profile.allowChildAgents && parentTask.permissions.includes('agent.create'),
    });
  }

  async run({ parentTask, profileId, objective, jobId, signal } = {}) {
    if (signal?.aborted) throw signal.reason ?? new Error('aborted');
    const profile = this.profiles.get(profileId);
    if (!profile) fail('SUBAGENT_PROFILE_NOT_FOUND', `Unknown profile: ${profileId}`);
    const child = this.buildChild({ parentTask, profile, profileId, objective, jobId });
    const releaseGlobal = await this.global.acquire(signal);
    let releaseExclusive = () => {};
    try {
      releaseExclusive = await this.exclusive.acquire(child.exclusiveTools, signal);
      await this.emit('subagent.started', { childId: child.id, jobId: child.jobId, parentTaskId: child.parentTaskId, profileId, objective: child.objective });
      const output = await this.runner(child, { signal });
      let structuredResult = null;
      let structuredResultReceiptSha256 = null;
      if (output?.structuredResult != null) {
        if (!this.resultValidator) fail('SUBAGENT_RESULT_VALIDATOR_REQUIRED', 'structuredResult requires an evidence validator');
        const validated = await this.resultValidator({ child, result: output.structuredResult });
        structuredResult = validated?.result ?? output.structuredResult;
        structuredResultReceiptSha256 = String(validated?.receiptSha256 ?? '');
        if (!/^[a-f0-9]{64}$/i.test(structuredResultReceiptSha256)) fail('SUBAGENT_RESULT_RECEIPT_INVALID', 'structuredResult validation receipt is required');
      }
      const normalized = frozen({
        summary: String(output?.summary ?? '').slice(0, 20_000),
        receipts: Object.freeze([...(output?.receipts ?? [])].map(String).slice(0, 2048)),
        output: output?.output ?? null,
        ...(structuredResult ? { structuredResult, structuredResultReceiptSha256 } : {}),
      });
      const envelope = { schema: 'forge.subagent-handoff.v1', child, result: normalized, completedAt: new Date().toISOString() };
      const handoffDigest = digest(envelope);
      const signature = this.signer?.sign ? await this.signer.sign(handoffDigest) : null;
      const handoff = frozen({ ...envelope, digest: handoffDigest, signature });
      await this.emit('subagent.completed', { childId: child.id, jobId: child.jobId, profileId, handoffDigest, receipts: normalized.receipts.length });
      return frozen({ child, handoff });
    } catch (error) {
      await this.emit(signal?.aborted ? 'subagent.cancelled' : 'subagent.failed', { childId: child.id, jobId: child.jobId, profileId, errorCode: error.code ?? 'SUBAGENT_FAILED', message: String(error.message ?? error).slice(0, 1000) });
      throw error;
    } finally {
      releaseExclusive();
      releaseGlobal();
    }
  }

  async runGraph({ parentTask, jobs = [], signal } = {}) {
    const byId = new Map();
    for (const job of jobs) {
      const id = String(job.id ?? '').trim();
      if (!id || byId.has(id)) fail('SUBAGENT_GRAPH_INVALID', `Duplicate or empty job id: ${id}`);
      byId.set(id, { ...job, id, dependencies: [...new Set((job.dependencies ?? []).map(String))] });
    }
    for (const job of byId.values()) for (const dependency of job.dependencies) if (!byId.has(dependency)) fail('SUBAGENT_GRAPH_INVALID', `Unknown dependency ${dependency} for ${job.id}`);
    const pending = new Map(byId);
    const completed = new Map();
    while (pending.size) {
      if (signal?.aborted) throw signal.reason ?? new Error('aborted');
      const ready = [...pending.values()].filter((job) => job.dependencies.every((dependency) => completed.has(dependency)));
      if (!ready.length) fail('SUBAGENT_GRAPH_CYCLE', 'Subagent dependency graph contains a cycle');
      const waveController = new AbortController();
      const waveSignal = signal ? AbortSignal.any([signal, waveController.signal]) : waveController.signal;
      const settled = await Promise.allSettled(ready.map(async (job) => {
        try {
          return [job.id, await this.run({ parentTask, profileId: job.profileId, objective: job.objective, jobId: job.id, signal: waveSignal })];
        } catch (error) {
          if (!waveController.signal.aborted) waveController.abort(error);
          throw error;
        }
      }));
      const failed = settled.find((entry) => entry.status === 'rejected');
      if (failed) throw failed.reason;
      for (const entry of settled) {
        const [id, result] = entry.value;
        completed.set(id, result);
        pending.delete(id);
      }
    }
    return Object.freeze(jobs.map((job) => completed.get(String(job.id))));
  }


  async runAdaptiveGraph({ parentTask, jobs = [], reconcile = null, policy = {}, signal } = {}) {
    const resolvedPolicy = Object.freeze({
      minConfidence: boundedNumber(policy?.minConfidence, 0, 0, 1),
      minInformationGain: boundedNumber(policy?.minInformationGain, 0, 0, 1),
      maxJobs: Math.floor(boundedNumber(policy?.maxJobs, 64, 1, 256)),
      maxWaves: Math.floor(boundedNumber(policy?.maxWaves, 64, 1, 512)),
      maxMutations: Math.floor(boundedNumber(policy?.maxMutations, 256, 0, 2_048)),
    });
    if (!Array.isArray(jobs) || jobs.length > resolvedPolicy.maxJobs) fail('SUBAGENT_GRAPH_LIMIT', `Adaptive graph exceeds maxJobs=${resolvedPolicy.maxJobs}`);
    const pending = new Map();
    const completed = new Map();
    const stopped = new Map();
    const mutations = [];
    const record = async (type, detail) => { const event = await this.emit(type, detail); mutations.push(event); return event; };
    for (const raw of jobs) {
      const job = normalizeAdaptiveJob(raw, this.profiles);
      if (pending.has(job.id)) fail('SUBAGENT_GRAPH_INVALID', `Duplicate job id: ${job.id}`);
      pending.set(job.id, job);
    }
    validateAdaptiveGraph(pending);

    const stopJob = async (job, reason, detail) => {
      pending.delete(job.id);
      const item = frozen({ jobId: job.id, reason, detail: String(detail ?? reason).slice(0, 2_000) });
      stopped.set(job.id, item);
      await record('subagent.graph.job-stopped', { jobId: job.id, reason, detail: item.detail });
    };

    for (const job of [...pending.values()]) {
      if (job.confidence < resolvedPolicy.minConfidence) await stopJob(job, 'confidence-below-threshold', `${job.confidence}<${resolvedPolicy.minConfidence}`);
      else if (job.expectedInformationGain < resolvedPolicy.minInformationGain) await stopJob(job, 'information-gain-below-threshold', `${job.expectedInformationGain}<${resolvedPolicy.minInformationGain}`);
    }

    let revision = 0;
    let wave = 0;
    let mutationCount = 0;
    while (pending.size) {
      if (signal?.aborted) throw signal.reason ?? new Error('aborted');
      if (wave >= resolvedPolicy.maxWaves) fail('SUBAGENT_GRAPH_LIMIT', `Adaptive graph exceeds maxWaves=${resolvedPolicy.maxWaves}`);

      let propagated = true;
      while (propagated) {
        propagated = false;
        for (const job of [...pending.values()]) {
          const blockedBy = job.dependencies.find((dependency) => stopped.has(dependency));
          if (!blockedBy) continue;
          await stopJob(job, 'dependency-stopped', blockedBy);
          propagated = true;
        }
      }
      if (!pending.size) break;
      validateAdaptiveGraph(pending, new Set(completed.keys()), new Set(stopped.keys()));
      const ready = [...pending.values()].filter((job) => job.dependencies.every((dependency) => completed.has(dependency)));
      if (!ready.length) fail('SUBAGENT_GRAPH_CYCLE', 'Subagent dependency graph contains a cycle or unresolved dependency');
      const concurrency = this.adaptiveConcurrency();
      if (concurrency <= 0) fail('SUBAGENT_ADMISSION_BLOCKED', 'Runtime resource policy blocks new subagents');
      const selected = [];
      for (const job of ready) {
        if (selected.length >= concurrency) break;
        const collision = selected.map((candidate) => ({ candidate, conflict: ownershipConflict(job, candidate) })).find((item) => item.conflict);
        if (collision) {
          await record('subagent.graph.ownership-serialized', { jobId: job.id, conflictsWith: collision.candidate.id, ownershipKind: collision.conflict.kind, ownershipValue: collision.conflict.value, wave: wave + 1 });
          continue;
        }
        selected.push(job);
      }
      if (!selected.length) selected.push(ready[0]);
      wave += 1;
      await record('subagent.graph.wave-started', { wave, revision, concurrency, jobIds: selected.map((job) => job.id), pending: pending.size });

      const settled = await Promise.allSettled(selected.map(async (job) => {
        while (job.attempts < job.maxAttempts) {
          job.attempts += 1;
          try {
            const result = await this.run({ parentTask, profileId: job.profileId, objective: job.objective, jobId: job.id, signal });
            return { job, result };
          } catch (error) {
            if (job.attempts >= job.maxAttempts) {
              await record('subagent.graph.attempts-exhausted', { jobId: job.id, attempts: job.attempts, errorCode: error?.code ?? 'SUBAGENT_FAILED', message: String(error?.message ?? error).slice(0, 1_000) });
              const exhausted = new Error(`SUBAGENT_JOB_ATTEMPTS_EXHAUSTED: ${job.id} failed after ${job.attempts} attempts`);
              exhausted.code = 'SUBAGENT_JOB_ATTEMPTS_EXHAUSTED';
              exhausted.cause = error;
              throw exhausted;
            }
            await record('subagent.graph.job-retry', { jobId: job.id, attempt: job.attempts, maxAttempts: job.maxAttempts, errorCode: error?.code ?? 'SUBAGENT_FAILED' });
          }
        }
        fail('SUBAGENT_JOB_ATTEMPTS_EXHAUSTED', `${job.id} exhausted attempts`);
      }));
      let firstFailure = null;
      for (const item of settled) {
        if (item.status === 'rejected') { firstFailure ??= item.reason; continue; }
        completed.set(item.value.job.id, frozen({ jobId: item.value.job.id, attempts: item.value.job.attempts, handoff: item.value.result }));
        pending.delete(item.value.job.id);
      }
      await record('subagent.graph.wave-completed', { wave, revision, completedJobIds: selected.filter((job) => completed.has(job.id)).map((job) => job.id), failedJobIds: selected.filter((job) => pending.has(job.id)).map((job) => job.id), remaining: pending.size });
      if (firstFailure) throw firstFailure;

      revision += 1;
      if (typeof reconcile !== 'function') continue;
      const patch = await reconcile(frozen({
        schema: 'forge.subagent-reconcile-input.v1', revision, wave,
        pending: [...pending.values()].map(publicJob),
        completed: [...completed.values()],
        stopped: [...stopped.values()],
        policy: resolvedPolicy,
      })) ?? {};
      const add = Array.isArray(patch.add) ? patch.add : [];
      const revise = Array.isArray(patch.revise) ? patch.revise : [];
      const revoke = Array.isArray(patch.revoke) ? [...new Set(patch.revoke.map(String))] : [];
      const requestedMutations = add.length + revise.length + revoke.length + (patch.stop ? pending.size : 0);
      mutationCount += requestedMutations;
      if (mutationCount > resolvedPolicy.maxMutations) fail('SUBAGENT_GRAPH_LIMIT', `Adaptive graph exceeds maxMutations=${resolvedPolicy.maxMutations}`);
      const reason = String(patch.reason ?? 'reconciler decision').slice(0, 2_000);

      for (const id of revoke) {
        if (completed.has(id) || stopped.has(id)) fail('SUBAGENT_GRAPH_MUTATION_DENIED', `Cannot revoke completed or stopped job: ${id}`);
        const job = pending.get(id);
        if (!job) fail('SUBAGENT_GRAPH_INVALID', `Unknown job to revoke: ${id}`);
        pending.delete(id);
        stopped.set(id, frozen({ jobId: id, reason: 'revoked', detail: reason }));
      }
      if (revoke.length) await record('subagent.graph.jobs-revoked', { revision, jobIds: revoke, reason });

      for (const patchJob of revise) {
        const id = String(patchJob?.id ?? '').trim();
        if (completed.has(id) || stopped.has(id)) fail('SUBAGENT_GRAPH_MUTATION_DENIED', `Cannot revise completed or stopped job: ${id}`);
        const current = pending.get(id);
        if (!current) fail('SUBAGENT_GRAPH_INVALID', `Unknown job to revise: ${id}`);
        const next = normalizeAdaptiveJob({ ...current, ...patchJob, id }, this.profiles);
        next.attempts = current.attempts;
        pending.set(id, next);
      }
      if (revise.length) await record('subagent.graph.jobs-revised', { revision, jobIds: revise.map((item) => String(item.id)), reason });

      if (pending.size + completed.size + stopped.size + add.length > resolvedPolicy.maxJobs) fail('SUBAGENT_GRAPH_LIMIT', `Adaptive graph exceeds maxJobs=${resolvedPolicy.maxJobs}`);
      const addedIds = [];
      for (const raw of add) {
        const job = normalizeAdaptiveJob(raw, this.profiles);
        if (pending.has(job.id) || completed.has(job.id) || stopped.has(job.id)) fail('SUBAGENT_GRAPH_INVALID', `Duplicate job id: ${job.id}`);
        pending.set(job.id, job);
        addedIds.push(job.id);
      }
      if (addedIds.length) await record('subagent.graph.jobs-added', { revision, jobIds: addedIds, reason });
      validateAdaptiveGraph(pending, new Set(completed.keys()), new Set(stopped.keys()));

      if (patch.stop) {
        for (const job of [...pending.values()]) await stopJob(job, 'reconciler-stop', reason);
        await record('subagent.graph.stopped', { revision, reason });
        break;
      }
    }

    const base = {
      schema: 'forge.subagent-adaptive-graph.v1',
      parentTaskId: String(parentTask?.id ?? ''),
      revisions: revision,
      waves: wave,
      completed: [...completed.values()],
      stopped: [...stopped.values()],
      mutations,
      policy: resolvedPolicy,
    };
    return frozen({ ...base, receiptSha256: digest(base) });
  }
}
