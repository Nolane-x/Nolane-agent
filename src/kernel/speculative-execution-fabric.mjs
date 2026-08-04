import { createId, deepFreeze, nowIso, required, signed, uniqueStrings } from './kernel-utils.mjs';

const ROLES = new Set(['coordinator', 'scout', 'builder', 'reviewer', 'integrator', 'tester', 'security']);
function pathConflict(left, right) {
  if (left === right) return true;
  const a = left.endsWith('/') ? left : `${left}/`; const b = right.endsWith('/') ? right : `${right}/`;
  return a.startsWith(b) || b.startsWith(a);
}
function normalizeTask(raw, index) {
  const role = ROLES.has(String(raw?.role)) ? String(raw.role) : 'builder';
  return deepFreeze({
    id: required(raw?.id ?? `lane-${index + 1}`, 'lane id', 256), title: required(raw?.title ?? raw?.objective ?? `Lane ${index + 1}`, 'lane title', 512),
    objective: required(raw?.objective, 'lane objective', 20_000), role, dependencies: uniqueStrings(raw?.dependencies, { maxItems: 128, maxLength: 256 }),
    ownedPaths: uniqueStrings(raw?.ownedPaths ?? raw?.allowedPaths, { maxItems: 256, maxLength: 2_000 }),
    ownedSymbols: uniqueStrings(raw?.ownedSymbols, { maxItems: 256, maxLength: 1_000 }),
    modelClass: String(raw?.modelClass ?? (role === 'scout' ? 'fast' : role === 'reviewer' ? 'reasoning' : 'coding')),
    maxAttempts: Math.max(1, Math.min(8, Number(raw?.maxAttempts) || 2)),
    informationGain: Math.max(0, Math.min(1, Number(raw?.informationGain ?? 0.5))),
    speculativeGroup: raw?.speculativeGroup == null ? null : String(raw.speculativeGroup),
    acceptanceCriteria: uniqueStrings(raw?.acceptanceCriteria, { maxItems: 128, maxLength: 2_000 }),
  });
}
function validate(tasks) {
  const byId = new Map();
  for (const task of tasks) { if (byId.has(task.id)) throw new Error(`duplicate lane id: ${task.id}`); byId.set(task.id, task); }
  for (const task of tasks) for (const dep of task.dependencies) if (!byId.has(dep)) throw new Error(`unknown dependency ${dep} for ${task.id}`);
  const visiting = new Set(); const visited = new Set();
  const visit = (id) => { if (visited.has(id)) return; if (visiting.has(id)) throw new Error('execution graph contains a cycle'); visiting.add(id); for (const dep of byId.get(id).dependencies) visit(dep); visiting.delete(id); visited.add(id); };
  for (const id of byId.keys()) visit(id);
  return byId;
}
function conflicts(task, active) {
  for (const other of active) {
    for (const path of task.ownedPaths) for (const candidate of other.ownedPaths) if (pathConflict(path, candidate)) return { with: other.id, kind: 'path', value: `${path}|${candidate}` };
    const symbols = new Set(other.ownedSymbols); for (const symbol of task.ownedSymbols) if (symbols.has(symbol)) return { with: other.id, kind: 'symbol', value: symbol };
  }
  return null;
}

export class SpeculativeExecutionFabric {
  constructor({ runner, reviewer, integrator = null, worktreeAdapter = null, eventSink = () => {}, clock = Date.now, maxConcurrency = 6 } = {}) {
    if (typeof runner !== 'function') throw new TypeError('SpeculativeExecutionFabric requires a lane runner');
    if (!reviewer?.reviewChange) throw new TypeError('SpeculativeExecutionFabric requires a reviewer boundary');
    this.runner = runner; this.reviewer = reviewer; this.integrator = typeof integrator === 'function' ? integrator : null;
    this.worktreeAdapter = worktreeAdapter; this.eventSink = eventSink; this.clock = clock; this.maxConcurrency = Math.max(1, Math.min(32, Number(maxConcurrency) || 6));
  }

  compilePlan({ threadId, projectId = null, objective, tasks = [], maxConcurrency = this.maxConcurrency, strategy = 'adaptive-dag' } = {}) {
    const normalized = tasks.map(normalizeTask); const byId = validate(normalized);
    const waves = []; const completed = new Set();
    while (completed.size < normalized.length) {
      const wave = normalized.filter((task) => !completed.has(task.id) && task.dependencies.every((dep) => completed.has(dep)));
      if (!wave.length) throw new Error('execution graph cannot make progress');
      waves.push(wave.map((item) => item.id)); for (const item of wave) completed.add(item.id);
    }
    const conflictMatrix = [];
    for (let i = 0; i < normalized.length; i += 1) for (let j = i + 1; j < normalized.length; j += 1) {
      const conflict = conflicts(normalized[i], [normalized[j]]); if (conflict) conflictMatrix.push({ left: normalized[i].id, right: normalized[j].id, ...conflict });
    }
    return signed({
      schema: 'nolane.sovereign-execution-plan.v1', id: createId('plan'), threadId: required(threadId, 'threadId', 256), projectId: projectId == null ? null : required(projectId, 'projectId', 256), objective: required(objective, 'objective', 40_000),
      strategy: String(strategy), maxConcurrency: Math.max(1, Math.min(this.maxConcurrency, Number(maxConcurrency) || this.maxConcurrency)),
      tasks: deepFreeze(normalized), waves: deepFreeze(waves), conflictMatrix: deepFreeze(conflictMatrix), createdAt: nowIso(this.clock),
      claims: deepFreeze({ isolatedLanesRequested: Boolean(this.worktreeAdapter), conflictsRepresented: true, unreviewedMergeAllowed: false }),
    });
  }

  async execute({ plan, contextPacket = null, signal = null } = {}) {
    if (plan?.schema !== 'nolane.sovereign-execution-plan.v1') throw new TypeError('valid sovereign execution plan is required');
    const tasks = plan.tasks.map((item) => ({ ...item })); const byId = validate(tasks);
    const states = new Map(tasks.map((task) => [task.id, { state: 'queued', attempts: 0, result: null, review: null, integration: null, error: null }]));
    const active = new Map(); const completed = new Set(); const failed = new Set(); const stopped = new Set();
    const emit = async (type, payload) => { const event = signed({ schema: 'nolane.sovereign-execution-event.v1', type, threadId: plan.threadId, planId: plan.id, payload, at: nowIso(this.clock) }); await this.eventSink(event); return event; };
    const runLane = async (task) => {
      const state = states.get(task.id); state.state = 'running'; state.attempts += 1;
      const workspace = this.worktreeAdapter?.create ? await this.worktreeAdapter.create({ threadId: plan.threadId, planId: plan.id, laneId: task.id, ownedPaths: task.ownedPaths }) : null;
      await emit('lane.started', { laneId: task.id, attempt: state.attempts, workspaceId: workspace?.id ?? null });
      try {
        const result = await this.runner({ task, plan, contextPacket, workspace, signal, attempt: state.attempts });
        const reviewInput = { threadId: plan.threadId, executorId: String(result?.executorId ?? task.id), evidence: result?.evidence ?? [], rules: task.acceptanceCriteria, metadata: { planId: plan.id, laneId: task.id, workspaceId: workspace?.id ?? null, role: task.role } };
        const review = String(result?.diff ?? '').trim()
          ? await this.reviewer.reviewChange({ ...reviewInput, diff: String(result.diff), tests: result?.tests ?? [] })
          : await this.reviewer.reviewOutcome({ ...reviewInput, output: String(result?.output ?? result?.summary ?? '') });
        state.result = result; state.review = review;
        if (review.decision !== 'approved') {
          if (state.attempts < task.maxAttempts) { state.state = 'queued'; await emit('lane.repair-required', { laneId: task.id, reviewReceiptSha256: review.receiptSha256, attempt: state.attempts }); return; }
          state.state = 'failed'; state.error = 'review-changes-required'; failed.add(task.id); await emit('lane.failed', { laneId: task.id, reason: state.error, reviewReceiptSha256: review.receiptSha256 }); return;
        }
        if (this.integrator) state.integration = await this.integrator({ task, plan, result, review, workspace, signal });
        state.state = 'completed'; completed.add(task.id); await emit('lane.completed', { laneId: task.id, reviewReceiptSha256: review.receiptSha256, integrationReceiptSha256: state.integration?.receiptSha256 ?? null });
      } catch (error) {
        state.error = String(error?.message ?? error);
        if (state.attempts < task.maxAttempts) { state.state = 'queued'; await emit('lane.retrying', { laneId: task.id, attempt: state.attempts, error: state.error }); }
        else { state.state = 'failed'; failed.add(task.id); await emit('lane.failed', { laneId: task.id, reason: state.error }); }
      } finally {
        if (workspace && this.worktreeAdapter?.release) await this.worktreeAdapter.release(workspace, { keep: state.state === 'failed' }).catch(() => {});
      }
    };
    await emit('plan.started', { planReceiptSha256: plan.receiptSha256, taskCount: tasks.length });
    while (completed.size + failed.size + stopped.size < tasks.length) {
      if (signal?.aborted) throw signal.reason ?? new Error('execution aborted');
      for (const task of tasks) {
        const state = states.get(task.id); if (state.state !== 'queued' || active.has(task.id)) continue;
        if (task.dependencies.some((dep) => failed.has(dep) || stopped.has(dep))) { state.state = 'stopped'; state.error = 'dependency-failed'; stopped.add(task.id); await emit('lane.stopped', { laneId: task.id, reason: state.error }); continue; }
        if (!task.dependencies.every((dep) => completed.has(dep))) continue;
        if (active.size >= plan.maxConcurrency) break;
        const conflict = conflicts(task, [...active.keys()].map((id) => byId.get(id))); if (conflict) continue;
        const promise = runLane(task).finally(() => active.delete(task.id)); active.set(task.id, promise);
      }
      if (!active.size) {
        const queued = tasks.filter((task) => states.get(task.id).state === 'queued');
        if (!queued.length) break;
        throw Object.assign(new Error('execution graph deadlocked on unresolved ownership conflict'), { code: 'SOVEREIGN_EXECUTION_DEADLOCK' });
      }
      await Promise.race(active.values());
    }
    await Promise.all(active.values());
    const summary = [...states.entries()].map(([laneId, value]) => ({ laneId, state: value.state, attempts: value.attempts, error: value.error, reviewReceiptSha256: value.review?.receiptSha256 ?? null, integrationReceiptSha256: value.integration?.receiptSha256 ?? null }));
    const status = failed.size ? 'failed' : stopped.size ? 'partial' : 'completed';
    const receipt = signed({ schema: 'nolane.sovereign-execution-receipt.v1', threadId: plan.threadId, planId: plan.id, status, lanes: deepFreeze(summary), completed: [...completed], failed: [...failed], stopped: [...stopped], finishedAt: nowIso(this.clock), claims: deepFreeze({ allMergedChangesReviewed: summary.filter((item) => item.state === 'completed').every((item) => Boolean(item.reviewReceiptSha256)), hiddenReasoningStored: false }) });
    await emit('plan.finished', { status, executionReceiptSha256: receipt.receiptSha256 });
    return receipt;
  }
}
