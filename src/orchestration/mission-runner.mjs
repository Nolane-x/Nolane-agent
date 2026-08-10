import { TaskGraph } from './task-graph.mjs';
import { createEvent } from '../protocol/events.mjs';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { buildTaskGovernanceEnvelope } from './architecture-stage-gate.mjs';

const ROLES = new Set(['coordinator', 'scout', 'builder', 'reviewer', 'integrator']);
const HASH = /^[a-f0-9]{64}$/i;

function plannerObject(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new Error('Planner output must be valid JSON'); }
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) throw new Error('Planner output must contain a tasks array');
  if (parsed.tasks.length < 1 || parsed.tasks.length > 64) throw new Error('Planner must create between 1 and 64 tasks');
  return parsed;
}

function validatePlan(value) {
  const plan = plannerObject(value);
  const tasks = plan.tasks.map((task, index) => {
    const id = String(task.id ?? `task-${index + 1}`).trim();
    const role = String(task.role ?? '').trim();
    if (!ROLES.has(role)) throw new Error(`Unknown agent role: ${role}`);
    return { id, title: String(task.title ?? ''), objective: String(task.objective ?? ''), role, dependencies: [...(task.dependencies ?? [])].map(String), allowedPaths: [...(task.allowedPaths ?? [])].map(String), deniedPaths: [...(task.deniedPaths ?? [])].map(String), metadata: structuredClone(task.metadata ?? {}) };
  });
  const builders = tasks.filter((task) => task.role === 'builder');
  const reviewers = tasks.filter((task) => task.role === 'reviewer');
  if (builders.length && !reviewers.length) throw new Error('A builder task requires an independent reviewer task');
  for (const builder of builders) if (!reviewers.some((reviewer) => reviewer.dependencies.includes(builder.id))) throw new Error(`Builder ${builder.id} is missing a dependent reviewer`);
  for (const task of tasks) if (!task.title.trim() || !task.objective.trim()) throw new Error(`Task ${task.id} needs title and objective`);
  const graph = TaskGraph.validate(tasks);
  return { summary: String(plan.summary ?? ''), tasks, graph };
}

export class MissionRunner {
  constructor({ store, scheduler, agentLoop, forge, interrupts = null, workspaceService = null, memoryService = null, baselineProvider = null, outcomeService = null } = {}) {
    if (!store || !scheduler || !agentLoop || !forge) throw new TypeError('MissionRunner dependencies are required');
    this.store = store; this.scheduler = scheduler; this.agentLoop = agentLoop; this.forge = forge; this.interrupts = interrupts; this.workspaceService = workspaceService; this.memoryService = memoryService; this.baselineProvider = typeof baselineProvider === 'function' ? baselineProvider : null; this.outcomeService = outcomeService; this.active = new Map();
  }

  #event(type, payload, refs) { return this.store.appendEvent(createEvent(type, payload, refs)); }

  #applyQueuedFollowUps(task) {
    const mission = this.store.getMission(task.missionId);
    const followUps = Array.isArray(mission?.metadata?.followUps) ? mission.metadata.followUps : [];
    const applied = new Set(Array.isArray(task.metadata?.appliedFollowUpIds) ? task.metadata.appliedFollowUpIds : []);
    const pending = followUps.filter((item) => item?.id && !applied.has(item.id) && String(item.content ?? '').trim());
    if (!pending.length) return task;
    const additions = pending.map((item, index) => `${index + 1}. ${String(item.content).trim().slice(0, 4_000)}`).join('\n');
    return this.store.updateTask(task.id, {
      objective: `${task.objective}\n\nAdditional user direction received during this run:\n${additions}`,
      metadata: {
        ...task.metadata,
        appliedFollowUpIds: [...applied, ...pending.map((item) => item.id)],
        userFollowUps: [...(Array.isArray(task.metadata?.userFollowUps) ? task.metadata.userFollowUps : []), ...pending.map((item) => ({ id: item.id, content: String(item.content).slice(0, 4_000), createdAt: item.createdAt }))],
      },
    });
  }

  async plan({ missionId = null, projectId, objective, planner, planningMetadata = {} }) {
    if (typeof planner !== 'function') throw new TypeError('planner function is required');
    const validated = validatePlan(await planner({ projectId, objective }));
    const selectedPlanningMetadata = planningMetadata && typeof planningMetadata === 'object' ? structuredClone(planningMetadata) : {};
    let mission;
    if (missionId) {
      const current = this.store.getMission(missionId);
      if (!current) throw new Error(`Unknown mission: ${missionId}`);
      if (current.projectId !== projectId) throw new Error('Mission does not belong to project');
      mission = this.store.updateMission(missionId, { objective, status: 'running', metadata: { ...current.metadata, ...selectedPlanningMetadata, summary: validated.summary, plannedAt: new Date().toISOString() } });
    } else {
      mission = this.store.createMission({ projectId, objective, status: 'running', metadata: { ...selectedPlanningMetadata, summary: validated.summary } });
    }
    const idMap = new Map(validated.tasks.map((task) => [task.id, `${mission.id}_${task.id.replace(/[^A-Za-z0-9._-]+/g, '-')}`]));
    const byId = new Map(validated.tasks.map((task) => [task.id, task]));
    const created = [];
    for (const localId of validated.graph.order) {
      const task = byId.get(localId);
      const governedRepairRole = task.role === 'builder' || task.role === 'integrator';
      const taskMetadata = structuredClone(task.metadata ?? {});
      if (!taskMetadata.taskKind) taskMetadata.taskKind = task.role;
      const governanceEnvelope = buildTaskGovernanceEnvelope({ role: task.role, resourceLimits: taskMetadata.resourceLimits ?? {} });
      taskMetadata.governanceEnvelope = governanceEnvelope;
      taskMetadata.resourceLimits = governanceEnvelope.resourceLimits;
      taskMetadata.executionClass = governanceEnvelope.executionClass;
      taskMetadata.mutationAllowed = governanceEnvelope.mutationAllowed;
      if (governedRepairRole && !taskMetadata.testMatrix) taskMetadata.testMatrix = { changedPaths: [...task.allowedPaths], relatedTests: [], requireFull: true };
      if (governedRepairRole && !taskMetadata.selfFix) taskMetadata.selfFix = { enabled: true, maxAttempts: 3, maxStagnantAttempts: 1 };
      created.push(this.store.createTask({
        id: idMap.get(localId), projectId, missionId: mission.id, title: task.title, objective: task.objective, status: 'ready', role: task.role,
        dependencies: task.dependencies.map((dependency) => idMap.get(dependency)), allowedPaths: task.allowedPaths, deniedPaths: task.deniedPaths,
        metadata: {
          ...taskMetadata,
          plannerTaskId: localId,
          ...(mission.metadata?.goalId ? { goalId: mission.metadata.goalId } : {}),
          ...(mission.metadata?.goalAutoApplyPlanPatches !== undefined ? { goalAutoApplyPlanPatches: mission.metadata.goalAutoApplyPlanPatches === true } : {}),
          ...(Array.isArray(mission.metadata?.browserAllowedActions) ? { browserAllowedActions: [...mission.metadata.browserAllowedActions] } : {}),
          ...(Array.isArray(mission.metadata?.mcpAllowedTools) ? { mcpAllowedTools: [...mission.metadata.mcpAllowedTools] } : {}),
        },
      }));
    }
    this.#event('mission.planned', { summary: validated.summary, taskCount: created.length }, { projectId, missionId: mission.id });
    return Object.freeze({ ...mission, tasks: Object.freeze(created) });
  }

  async runNext({ missionId, workerId, providerId, modelId = undefined, signal = null, budgets = undefined }) {
    const mission = this.store.getMission(missionId);
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    if (mission.status !== 'running') throw new Error(`Mission is ${mission.status}`);
    const lease = this.scheduler.claim({ missionId, workerId });
    if (!lease) return null;
    const directedTask = this.#applyQueuedFollowUps(lease.task);
    let preparedTask = this.workspaceService ? await this.workspaceService.prepare(directedTask) : directedTask;
    if (this.baselineProvider && preparedTask.metadata?.selfFix?.enabled === true && preparedTask.metadata?.testMatrix && !preparedTask.metadata?.testBaseline) {
      const baseline = await this.baselineProvider(preparedTask, { signal });
      preparedTask = this.store.updateTask(preparedTask.id, { metadata: { ...preparedTask.metadata, testBaseline: structuredClone(baseline) } });
      this.#event('mission.task.test-baseline-captured', { scope: baseline?.scope ?? null, status: baseline?.status ?? null, receiptSha256: baseline?.receiptSha256 ?? null }, { projectId: preparedTask.projectId, missionId, taskId: preparedTask.id });
    }
    const activeLease = Object.freeze({ ...lease, task: preparedTask });
    const controller = new AbortController();
    const missionRuns = this.active.get(missionId) ?? new Map(); missionRuns.set(preparedTask.id, controller); this.active.set(missionId, missionRuns);
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    this.#event('mission.task.started', { workerId, fencingToken: activeLease.fencingToken, role: preparedTask.role, executionWorkspace: preparedTask.metadata?.executionWorkspace ?? null }, { projectId: preparedTask.projectId, missionId, taskId: preparedTask.id });
    try {
      const selectedModelId = modelId ?? mission.metadata?.planningModelId ?? undefined;
      const result = await this.agentLoop.run(preparedTask, { providerId, ...(selectedModelId ? { model: selectedModelId } : {}), signal: combined, budgets: { ...(preparedTask.metadata?.resourceLimits ?? {}), ...(budgets ?? {}) } });
      const handoffBase = {
        schema: 'forge.task.handoff.v1',
        taskId: preparedTask.id,
        role: preparedTask.role,
        runId: result.runId,
        providerId: result.providerId ?? providerId ?? 'auto',
        output: String(result.output ?? '').slice(0, 20_000),
        outputTruncated: String(result.output ?? '').length > 20_000,
        receiptSha256s: (result.receipts ?? []).map((receipt) => receipt.receiptSha256),
        executionWorkspace: preparedTask.metadata?.executionWorkspace ?? null,
        worktreeBranch: preparedTask.metadata?.worktree?.branch ?? null,
      };
      const handoff = Object.freeze({ ...handoffBase, handoffSha256: canonicalSha256(handoffBase) });
      const task = this.store.updateTask(preparedTask.id, { status: 'review', metadata: { ...preparedTask.metadata, candidateRunId: result.runId, candidateOutput: result.output, handoff } });
      this.#event('mission.task.awaiting-verification', { runId: result.runId, receiptCount: result.receipts?.length ?? 0 }, { projectId: task.projectId, missionId, taskId: task.id });
      return Object.freeze({ mission: this.store.getMission(missionId), task, lease: activeLease, result });
    } catch (error) {
      const current = this.store.getTask(preparedTask.id);
      if (current?.leaseOwner === workerId && current.fencingToken === lease.fencingToken) {
        const missionState = this.store.getMission(missionId)?.status;
        const nextStatus = combined.aborted && missionState === 'paused' ? 'ready' : combined.aborted ? 'cancelled' : 'failed';
        this.store.updateTask(current.id, { status: nextStatus, leaseOwner: null, leaseExpiresAt: null, metadata: { ...current.metadata, failureReason: String(error.message ?? error) } });
      }
      this.#event('mission.task.failed', { error: String(error.message ?? error), cancelled: combined.aborted }, { projectId: preparedTask.projectId, missionId, taskId: preparedTask.id });
      throw error;
    } finally {
      missionRuns.delete(preparedTask.id); if (!missionRuns.size) this.active.delete(missionId);
    }
  }


  async repairVerification({ taskId, workerId, fencingToken, providerId = 'auto', repairRequest, signal = null, budgets = undefined } = {}) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    if (task.status !== 'review') throw new Error(`Task ${taskId} must be in review before repair`);
    if (task.leaseOwner && workerId && task.leaseOwner !== workerId) throw new Error('Verification repair worker does not own task lease');
    if (task.fencingToken && fencingToken && task.fencingToken !== fencingToken) throw new Error('Verification repair fencing token is stale');
    const request = repairRequest && typeof repairRequest === 'object' ? repairRequest : {};
    const newDiagnostics = Array.isArray(request.delta?.newDiagnostics) ? request.delta.newDiagnostics.slice(0, 50) : [];
    if (!newDiagnostics.length) throw new Error('Verification repair requires at least one newly introduced diagnostic');
    const attempt = Number(request.attempt ?? 1);
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 20) throw new TypeError('Verification repair attempt must be between 1 and 20');
    const strategyId = request.requiredStrategyChange === true ? `alternate-verification-repair-${attempt}` : 'targeted-verification-repair';
    const diagnosticLines = newDiagnostics.map((item, index) => `${index + 1}. ${String(item.path ?? '<unknown>')}:${Number(item.line ?? 0)}:${Number(item.column ?? 0)} ${String(item.severity ?? 'error')} ${String(item.code ?? '')}: ${String(item.message ?? '').slice(0, 500)}`);
    const repairObjective = `${task.objective}\n\nVerification repair attempt ${attempt}. Address only these newly introduced diagnostics:\n${diagnosticLines.join('\n')}\n\nDo not expand scope or repair pre-existing diagnostics. ${request.requiredStrategyChange === true ? `The previous strategy ${String(request.previousStrategyId ?? '<unknown>')} made no progress; use a materially different approach.` : 'Use the smallest evidence-driven correction.'} Re-run the targeted verification and report receipts.`;
    const repairTask = Object.freeze({
      ...task,
      objective: repairObjective,
      metadata: Object.freeze({
        ...task.metadata,
        verificationRepair: Object.freeze({
          attempt,
          strategyId,
          requiredStrategyChange: request.requiredStrategyChange === true,
          previousStrategyId: request.previousStrategyId ?? null,
          failingTestReceiptSha256: request.failingTestReceiptSha256 ?? null,
          stateSha256: request.stateSha256 ?? null,
          newDiagnosticFingerprints: newDiagnostics.map((item) => item.fingerprint ?? canonicalSha256(item)),
        }),
      }),
    });
    this.#event('mission.task.verification-repair-started', { attempt, strategyId, diagnosticCount: newDiagnostics.length }, { projectId: task.projectId, missionId: task.missionId, taskId: task.id });
    const result = await this.agentLoop.run(repairTask, { providerId, signal, budgets });
    const base = {
      schema: 'forge.verification-repair-receipt.v1',
      taskId: task.id,
      attempt,
      strategyId,
      runId: result.runId,
      stateSha256: request.stateSha256 ?? null,
      outputSha256: canonicalSha256(String(result.output ?? '')),
      sourceReceiptSha256s: (result.receipts ?? []).map((receipt) => receipt.receiptSha256).filter(Boolean),
    };
    const receiptSha256 = canonicalSha256(base);
    const history = [...(Array.isArray(task.metadata?.verificationRepairHistory) ? task.metadata.verificationRepairHistory : []), { ...base, receiptSha256 }];
    const next = this.store.updateTask(task.id, {
      metadata: {
        ...task.metadata,
        candidateRunId: result.runId,
        candidateOutput: result.output,
        verificationRepairHistory: history,
      },
    });
    this.#event('mission.task.verification-repair-completed', { attempt, strategyId, runId: result.runId, receiptSha256 }, { projectId: task.projectId, missionId: task.missionId, taskId: task.id });
    return Object.freeze({ status: 'applied', strategyId, receiptSha256, result, task: next });
  }

  async rejectVerification({ taskId, workerId, fencingToken, report } = {}) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    if (task.status !== 'review') throw new Error(`Task ${taskId} must be in review before rejection`);
    if (task.leaseOwner && workerId && task.leaseOwner !== workerId) throw new Error('Verification rejection worker does not own task lease');
    if (task.fencingToken && fencingToken && task.fencingToken !== fencingToken) throw new Error('Verification rejection fencing token is stale');
    const evidence = Array.isArray(report?.evidence) ? report.evidence : [];
    const failed = evidence.find((item) => item?.status !== 'pass') ?? null;
    const summary = String(failed?.summary ?? 'Verification gate failed').slice(0, 1_000);
    const next = this.store.updateTask(task.id, {
      status: 'failed',
      leaseOwner: null,
      leaseExpiresAt: null,
      metadata: {
        ...task.metadata,
        verificationFailure: {
          status: 'fail',
          summary,
          kind: failed?.kind ?? null,
          command: failed?.command ?? null,
          args: Array.isArray(failed?.args) ? [...failed.args] : [],
          exitCode: failed?.exitCode ?? null,
          failedAt: new Date().toISOString(),
        },
      },
    });
    this.#event('mission.task.verification-failed', { summary, kind: failed?.kind ?? null, exitCode: failed?.exitCode ?? null }, { projectId: task.projectId, missionId: task.missionId, taskId: task.id });
    return Object.freeze({ task: next, report });
  }

  async verify({ taskId, workerId, fencingToken, evidence }) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    const items = Array.isArray(evidence) ? evidence : [];
    if (!items.length || items.some((item) => item.status !== 'pass' || !item.commit || !HASH.test(String(item.artifactSha256 ?? '')) || !HASH.test(String(item.receiptSha256 ?? '')))) {
      throw new Error('Completion requires passing evidence bound to a commit, artifact hash, and receipt hash');
    }
    const recorded = [];
    for (const item of items) {
      recorded.push(this.store.addEvidence({ projectId: task.projectId, taskId, kind: item.kind ?? 'verification', status: 'pass', receiptSha256: item.receiptSha256, payload: { ...item } }));
      await this.forge.recordEvidence(task.projectId, {
        type: 'verification-note', title: `${item.kind ?? 'verification'} evidence`, summary: String(item.summary ?? 'Verification evidence recorded by Forge Studio.'),
        metadata: { taskId, commit: item.commit, artifactSha256: item.artifactSha256, receiptSha256: item.receiptSha256 },
      });
    }
    if (this.outcomeService?.recordVerification) {
      try {
        this.outcomeService.recordVerification({
          taskId: task.id,
          verified: true,
          evidenceReceiptSha256: items[0].receiptSha256,
          costUsd: Number(task.metadata?.candidateUsage?.costUsd ?? 0) || 0,
          latencyMs: Number(task.metadata?.candidateUsage?.latencyMs ?? 0) || 0,
        });
      } catch (error) {
        this.#event('provider.outcome-recording-failed', { error: String(error?.message ?? error).slice(0, 500) }, { projectId: task.projectId, missionId: task.missionId, taskId: task.id });
      }
    }
    let completed = this.scheduler.complete({ taskId, workerId, fencingToken });
    if (this.memoryService) {
      const observation = await this.memoryService.observe({
        projectId: task.projectId,
        title: `Verified task: ${task.title}`,
        content: [`Objective: ${task.objective}`, `Candidate output: ${String(task.metadata?.candidateOutput ?? '').slice(0, 12_000)}`, ...items.map((item) => `Evidence (${item.kind ?? 'verification'}): ${String(item.summary ?? 'passed')}`)].join('\n\n'),
        kind: 'episodic',
        confidence: 0.7,
        sourceTaskId: task.id,
        evidenceReceiptSha256: items[0].receiptSha256,
        actor: 'verification-gate',
      });
      completed = this.store.updateTask(completed.id, { metadata: { ...completed.metadata, memoryObservationId: observation.id } });
    }
    const remaining = this.store.listTasks({ missionId: task.missionId }).filter((item) => item.id !== taskId && item.status !== 'done');
    let mission = this.store.getMission(task.missionId);
    if (!remaining.length) mission = this.store.updateMission(task.missionId, { status: 'completed' });
    this.#event('mission.task.verified', { evidenceCount: recorded.length }, { projectId: task.projectId, missionId: task.missionId, taskId });
    return Object.freeze({ task: completed, mission, evidence: Object.freeze(recorded) });
  }


  interruptTask({ taskId, kind = 'operator-input', prompt = {}, expiresInMs, idempotencyKey } = {}) {
    if (!this.interrupts) throw new Error('Interrupt manager is not configured');
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    const interrupt = this.interrupts.create({ missionId: task.missionId, taskId, kind, prompt, expiresInMs, idempotencyKey });
    if (!interrupt.duplicate) {
      this.active.get(task.missionId)?.get(taskId)?.abort('durable interrupt');
      this.store.updateTask(taskId, { status: 'blocked', metadata: { ...task.metadata, activeInterruptId: interrupt.id } });
      this.#event('mission.task.interrupted', { interruptId: interrupt.id, kind, expiresAt: interrupt.expiresAt }, { projectId: task.projectId, missionId: task.missionId, taskId });
    }
    return interrupt;
  }

  resumeInterrupt({ interruptId, resumeToken, response = {}, idempotencyKey } = {}) {
    if (!this.interrupts) throw new Error('Interrupt manager is not configured');
    const interrupt = this.interrupts.resume({ interruptId, resumeToken, response, idempotencyKey });
    const task = this.store.getTask(interrupt.taskId);
    if (!task) throw new Error(`Unknown task: ${interrupt.taskId}`);
    const responses = { ...(task.metadata?.interruptResponses ?? {}) };
    if (!Object.hasOwn(responses, interrupt.id)) responses[interrupt.id] = structuredClone(interrupt.response);
    const nextTask = this.store.updateTask(task.id, { status: 'ready', leaseOwner: null, leaseExpiresAt: null, metadata: { ...task.metadata, activeInterruptId: null, interruptResponses: responses } });
    if (!interrupt.duplicate) this.#event('mission.task.resumed-from-interrupt', { interruptId: interrupt.id }, { projectId: task.projectId, missionId: task.missionId, taskId: task.id });
    return Object.freeze({ interrupt, task: nextTask });
  }

  pause(missionId, reason = 'operator pause') {
    const current = this.store.getMission(missionId);
    if (!current) throw new Error(`Unknown mission: ${missionId}`);
    const mission = this.store.updateMission(missionId, { status: 'paused', metadata: { ...current.metadata, pauseReason: String(reason), pausedAt: new Date().toISOString() } });
    for (const controller of this.active.get(missionId)?.values() ?? []) controller.abort(reason);
    this.#event('mission.paused', { reason: String(reason) }, { projectId: mission.projectId, missionId });
    return mission;
  }

  stop(missionId, reason = 'operator stop') {
    const mission = this.store.updateMission(missionId, { status: 'stopped', metadata: { ...this.store.getMission(missionId).metadata, stopReason: String(reason) } });
    for (const controller of this.active.get(missionId)?.values() ?? []) controller.abort(reason);
    this.#event('mission.stopped', { reason: String(reason) }, { projectId: mission.projectId, missionId });
    return mission;
  }

  resume(missionId) {
    const current = this.store.getMission(missionId);
    const mission = this.store.updateMission(missionId, { status: 'running', metadata: { ...current.metadata, resumedAt: new Date().toISOString() } });
    this.#event('mission.resumed', {}, { projectId: mission.projectId, missionId });
    return mission;
  }
}
