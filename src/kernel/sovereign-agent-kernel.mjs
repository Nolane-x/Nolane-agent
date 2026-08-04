import path from 'node:path';
import { SovereignThreadLedger } from './thread-ledger.mjs';
import { SovereignContextCompiler } from './context-compiler.mjs';
import { SovereignReviewerBoundary } from './reviewer-boundary.mjs';
import { CapabilityLeaseAuthority } from './capability-lease-authority.mjs';
import { SpeculativeExecutionFabric } from './speculative-execution-fabric.mjs';
import { deepFreeze, nowIso, signed, verifySigned } from './kernel-utils.mjs';

export class SovereignAgentKernel {
  static create(options = {}) { return new SovereignAgentKernel(options); }

  constructor({ dataDir = '.', file = null, clock = Date.now, laneRunner = null, worktreeAdapter = null, integrator = null, scanners = [], eventSink = () => {} } = {}) {
    this.clock = clock;
    this.externalEventSink = eventSink;
    this.ledger = new SovereignThreadLedger({ file: file ?? path.join(dataDir, 'sovereign-agent-kernel.db'), clock });
    this.contextCompiler = new SovereignContextCompiler({ clock });
    this.reviewer = new SovereignReviewerBoundary({ reviewerId: 'nolane-independent-reviewer', scanners, clock, autoApproveThrough: 'low' });
    this.capabilities = new CapabilityLeaseAuthority({ reviewer: this.reviewer, clock, eventSink: async (event) => this.#recordExternalEvent(event) });
    this.plans = new Map(); this.executions = new Map(); this.contextPackets = new Map();
    this.#hydrateArtifacts();
    const runner = laneRunner ?? (async ({ task }) => {
      const receipt = signed({ schema: 'nolane.sovereign-planning-only-evidence.v1', laneId: task.id, objective: task.objective, createdAt: nowIso(this.clock) });
      return { executorId: `lane:${task.id}`, output: 'Planning-only kernel lane completed without repository mutation.', evidence: [receipt.receiptSha256], planningOnly: true };
    });
    this.executionFabric = new SpeculativeExecutionFabric({ runner, reviewer: this.reviewer, integrator, worktreeAdapter, clock, eventSink: async (event) => this.#recordExternalEvent(event) });
  }


  #hydrateArtifacts() {
    const leases = [];
    for (const artifact of this.ledger.listArtifacts({ limit: 50_000 })) {
      const payload = artifact.payload;
      if (!verifySigned(payload)) continue;
      if (artifact.kind === 'execution-plan' && payload.schema === 'nolane.sovereign-execution-plan.v1') this.plans.set(payload.id, payload);
      else if (artifact.kind === 'execution-receipt' && payload.schema === 'nolane.sovereign-execution-receipt.v1') this.executions.set(payload.receiptSha256, payload);
      else if (artifact.kind === 'context-packet' && payload.schema === 'nolane.sovereign-context-packet.v1') this.contextPackets.set(payload.receiptSha256, payload);
      else if (artifact.kind === 'capability-lease' && payload.schema === 'nolane.sovereign-capability-lease.v1') leases.push(payload);
    }
    this.capabilities.restore(leases);
  }

  #persistArtifact(kind, payload, { id = null, threadId = null, projectId = null } = {}) {
    if (!verifySigned(payload)) throw new TypeError(`cannot persist unsigned or invalid ${kind} artifact`);
    const resolvedThreadId = threadId ?? payload.threadId;
    const resolvedProjectId = projectId ?? payload.projectId ?? this.ledger.getThread(resolvedThreadId).projectId;
    return this.ledger.putArtifact({ id: id ?? payload.id ?? payload.receiptSha256, threadId: resolvedThreadId, projectId: resolvedProjectId, kind, payload });
  }

  #persistLease(lease) {
    if (!lease) return null;
    return this.#persistArtifact('capability-lease', lease, { id: lease.id, threadId: lease.threadId, projectId: lease.projectId });
  }

  async #recordExternalEvent(event) {
    if (event?.threadId) {
      const thread = this.ledger.getThread(event.threadId);
      this.ledger.appendEvent({ threadId: thread.id, type: event.type ?? 'kernel.event', actor: 'sovereign-kernel', payload: event.payload ?? event, expectedRevision: thread.revision, epoch: thread.epoch });
    }
    await this.externalEventSink(event);
  }

  createThread(input) { return this.ledger.createThread(input); }
  getThread(threadId) { return this.ledger.getThread(threadId); }
  listThreads(input) { return this.ledger.listThreads(input); }
  timeline(threadId, input) { return this.ledger.timeline(threadId, input); }

  compileContext(threadId, input = {}) {
    const thread = this.ledger.getThread(threadId);
    const packet = this.contextCompiler.compile({ ...input, thread });
    this.contextPackets.set(packet.receiptSha256, packet);
    this.#persistArtifact('context-packet', packet, { threadId: thread.id, projectId: thread.projectId });
    this.ledger.appendEvent({ threadId, type: 'context.compiled', actor: input.actor ?? 'sovereign-kernel', payload: { contextReceiptSha256: packet.receiptSha256, tokenEstimate: packet.tokenEstimate, tokenBudget: packet.tokenBudget, targetPaths: packet.targetPaths }, expectedRevision: thread.revision, epoch: thread.epoch });
    return packet;
  }

  compilePlan(threadId, input = {}) {
    const thread = this.ledger.getThread(threadId);
    const plan = this.executionFabric.compilePlan({ ...input, threadId, projectId: input.projectId ?? thread.projectId, objective: input.objective ?? thread.objective });
    this.plans.set(plan.id, plan);
    this.#persistArtifact('execution-plan', plan, { id: plan.id, threadId: thread.id, projectId: thread.projectId });
    this.ledger.appendEvent({ threadId, type: 'execution.plan-compiled', actor: input.actor ?? 'sovereign-kernel', payload: { planId: plan.id, planReceiptSha256: plan.receiptSha256, taskCount: plan.tasks.length, waves: plan.waves.length }, expectedRevision: thread.revision, epoch: thread.epoch });
    return plan;
  }

  async executePlan(threadId, planId, { contextReceiptSha256 = null, signal = null } = {}) {
    const thread = this.ledger.getThread(threadId); const plan = this.plans.get(String(planId));
    if (!plan || plan.threadId !== thread.id) throw Object.assign(new Error(`plan not found: ${planId}`), { code: 'SOVEREIGN_PLAN_NOT_FOUND', statusCode: 404 });
    const contextPacket = contextReceiptSha256 ? this.contextPackets.get(String(contextReceiptSha256)) : null;
    const receipt = await this.executionFabric.execute({ plan, contextPacket, signal });
    this.executions.set(receipt.receiptSha256, receipt);
    this.#persistArtifact('execution-receipt', receipt, { threadId: thread.id, projectId: thread.projectId });
    const current = this.ledger.getThread(threadId);
    this.ledger.appendEvent({ threadId, type: 'execution.finished', actor: 'sovereign-kernel', payload: { planId: plan.id, executionReceiptSha256: receipt.receiptSha256, status: receipt.status }, expectedRevision: current.revision, epoch: current.epoch, nextState: receipt.status === 'completed' ? 'review' : 'blocked' });
    return receipt;
  }

  async requestCapability(threadId, input = {}) {
    const thread = this.ledger.getThread(threadId);
    const result = await this.capabilities.request({ ...input, threadId, projectId: input.projectId ?? thread.projectId, actorId: input.actorId ?? thread.principalId });
    this.#persistLease(result.lease);
    return result;
  }

  authorizeCapability(input) {
    const result = this.capabilities.authorize(input);
    if (result.leaseId) this.#persistLease(this.capabilities.get(result.leaseId));
    return result;
  }

  decideCapability(leaseId, input) {
    const lease = this.capabilities.decide(leaseId, input);
    this.#persistLease(lease);
    return lease;
  }

  revokeCapability(leaseId, input) {
    const lease = this.capabilities.revoke(leaseId, input);
    this.#persistLease(lease);
    return lease;
  }

  checkpoint(threadId, input = {}) {
    const thread = this.ledger.getThread(threadId);
    const snapshot = {
      thread, plans: [...this.plans.values()].filter((item) => item.threadId === threadId).map((item) => ({ id: item.id, receiptSha256: item.receiptSha256 })),
      capabilities: this.capabilities.list({ threadId }).map((item) => ({ id: item.id, state: item.state, receiptSha256: item.receiptSha256 })),
      contextReceipts: [...this.contextPackets.values()].filter((item) => item.threadId === threadId).map((item) => item.receiptSha256),
      ...input.snapshot,
    };
    return this.ledger.checkpoint(threadId, { ...input, snapshot, expectedRevision: input.expectedRevision ?? thread.revision, epoch: input.epoch ?? thread.epoch });
  }

  transition(threadId, state, input = {}) { return this.ledger.transition(threadId, state, input); }
  resumeFromCheckpoint(checkpointId, input = {}) { return this.ledger.resumeFromCheckpoint(checkpointId, input); }

  snapshot({ threadId = null, projectId = null } = {}) {
    const threads = threadId ? [this.ledger.getThread(threadId)] : this.ledger.listThreads({ projectId, limit: 500 });
    const threadIds = new Set(threads.map((item) => item.id));
    const plans = [...this.plans.values()].filter((item) => threadIds.has(item.threadId));
    const capabilitySnapshot = this.capabilities.snapshot({ threadId, projectId });
    const contextPackets = [...this.contextPackets.values()].filter((item) => threadIds.has(item.threadId));
    const byState = Object.fromEntries(['running', 'paused', 'blocked', 'review', 'completed', 'failed', 'cancelled'].map((state) => [state, threads.filter((item) => item.state === state).length]));
    return signed({
      schema: 'nolane.sovereign-agent-kernel-snapshot.v1', version: 1, generatedAt: nowIso(this.clock),
      metrics: deepFreeze({ threads: threads.length, activeThreads: threads.filter((item) => ['running', 'blocked', 'review'].includes(item.state)).length, plans: plans.length, contextPackets: contextPackets.length, capabilityLeases: capabilitySnapshot.leases.length, pendingApprovals: capabilitySnapshot.byState.pending ?? 0 }),
      threadStates: deepFreeze(byState), threads: deepFreeze(threads), plans: deepFreeze(plans.map((item) => ({ id: item.id, threadId: item.threadId, taskCount: item.tasks.length, waves: item.waves.length, maxConcurrency: item.maxConcurrency, receiptSha256: item.receiptSha256 }))),
      capabilities: capabilitySnapshot, context: deepFreeze(contextPackets.map((item) => ({ threadId: item.threadId, tokenEstimate: item.tokenEstimate, tokenBudget: item.tokenBudget, utilization: item.utilization, receiptSha256: item.receiptSha256 }))),
      architecture: deepFreeze({ durableThreads: true, durableKernelArtifacts: true, restartResumablePlans: true, optimisticRevisionFencing: true, epochFencing: true, scopedCapabilityLeases: true, pathScopedContextCompilation: true, transcriptCompaction: true, adaptiveDagExecution: true, independentReviewBoundary: true, unreviewedMergeAllowed: false }),
    });
  }

  health() {
    const snapshot = this.snapshot();
    return signed({ schema: 'nolane.sovereign-agent-kernel-health.v1', status: 'ready', version: snapshot.version, metrics: snapshot.metrics, architecture: snapshot.architecture, checkedAt: nowIso(this.clock) });
  }

  close() { this.ledger.close(); }
}
