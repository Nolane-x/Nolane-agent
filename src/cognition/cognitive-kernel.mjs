import { ContextPosteriorManager } from './context-posterior-manager.mjs';
import { HypothesisPopulation } from './hypothesis-population.mjs';
import { EpistemicActionSelector } from './epistemic-action-selector.mjs';
import { StructuredErrorRouter } from './structured-error-router.mjs';
import { EpisodicBinder } from './episodic-binder.mjs';
import { AgencyLedger } from './agency-ledger.mjs';
import { ToolEffectVerifier } from './tool-effect-verifier.mjs';
import { CausalInterventionLab } from './causal-intervention-lab.mjs';
import { RecoveryLease, evaluateCommitGate, evaluateStopGate } from './cognitive-policy-gates.mjs';
import { boundedClone, signed, text } from './cognition-utils.mjs';

export class CognitiveKernel {
  constructor({ clock = () => Date.now(), context = {}, hypotheses = {}, selector = {}, errorRouter = {}, commitLimits = {}, limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxTasks = Math.max(1, Math.min(10_000, Math.floor(Number(limits.maxTasks) || 1_000)));
    this.maxReceipts = Math.max(1, Math.min(50_000, Math.floor(Number(limits.maxReceipts) || 5_000)));
    this.commitLimits = Object.freeze({ files: Math.max(1, Math.floor(Number(commitLimits.files) || 2)), changedLines: Math.max(1, Math.floor(Number(commitLimits.changedLines) || 80)) });
    this.contexts = new ContextPosteriorManager(context);
    this.hypotheses = new HypothesisPopulation(hypotheses);
    this.selector = new EpistemicActionSelector(selector);
    this.errorRouter = new StructuredErrorRouter(errorRouter);
    this.episodes = new EpisodicBinder({ maxEpisodes: limits.maxEpisodes ?? 2_000 });
    this.agency = new AgencyLedger({ maxEntries: limits.maxAgencyEntries ?? 2_000 });
    this._causalInterventionLab = null;
    this.effectVerifier = new ToolEffectVerifier({
      maxAssertions: limits.maxEffectAssertions ?? 512,
      maxProbes: limits.maxEffectProbes ?? 256,
      maxProbePaths: limits.maxEffectProbePaths ?? 512,
    });
    this.tasks = new Map();
    this.receipts = [];
    this.sequence = 0;
    this.closed = false;
  }

  startTask(input = {}) {
    this.#assertOpen();
    const taskId = text(input.taskId, 'taskId', 256);
    if (this.tasks.has(taskId)) throw new TypeError(`duplicate cognitive task: ${taskId}`);
    if (this.tasks.size >= this.maxTasks) throw new RangeError(`cognitive task limit exceeded: ${this.maxTasks}`);
    const goal = text(input.goal, 'goal');
    const contextSnapshot = this.contexts.start(taskId, input.contexts);
    const hypothesisSnapshot = this.hypotheses.start(taskId, input.hypotheses);
    const recoveryLease = new RecoveryLease({
      leaseId: input.recoveryLeaseId ?? `lease-${taskId}`,
      ttlMs: input.recoveryLeaseTtlMs ?? 15 * 60_000,
      clock: this.clock,
    });
    this.tasks.set(taskId, {
      taskId, goal, recoveryLease, observations: [], proposals: new Map(), verified: new Map(), committed: new Map(),
      recentErrorRoutes: [], episodeIds: [], rollbackReceipts: [], startedAtMs: Number(this.clock()),
    });
    return this.#record(signed({
      schema: 'forge.cognitive-task-start.v1', taskId, goal,
      contextReceiptSha256: contextSnapshot.receiptSha256,
      hypothesisReceiptSha256: hypothesisSnapshot.receiptSha256,
      recoveryLeaseId: recoveryLease.leaseId,
    }));
  }

  observe(taskId, event = {}) {
    this.#assertOpen();
    const task = this.#task(taskId);
    const eventId = text(event.eventId, 'eventId', 256);
    const type = text(event.type, 'event.type', 128);
    if (task.observations.includes(eventId)) throw new TypeError(`duplicate cognitive event: ${eventId}`);
    task.observations.push(eventId);
    while (task.observations.length > 512) task.observations.shift();
    const effects = {};
    if (event.contextEvidence) effects.context = this.contexts.observe(task.taskId, event.contextEvidence).receiptSha256;
    if (event.hypothesisEvidence) effects.hypotheses = this.hypotheses.observe(task.taskId, event.hypothesisEvidence).receiptSha256;
    if (type === 'falsify-hypothesis') effects.falsification = this.hypotheses.falsify(task.taskId, event.hypothesisId, eventId).receiptSha256;
    if (type === 'error') {
      const route = this.errorRouter.route(event.error ?? {});
      task.recentErrorRoutes.unshift(route);
      task.recentErrorRoutes = task.recentErrorRoutes.slice(0, 32);
      effects.errorRoute = route.receiptSha256;
    }
    if (type === 'strategy-failure') effects.recoveryGate = task.recoveryLease.recordFailure(event.strategyFingerprint, event.failureReceiptId ?? eventId).receiptSha256;
    if (type === 'agency') {
      const agency = event.agency ?? {};
      const claim = this.#record(signed({
        schema: 'forge.cognitive-agency-claim.v1', taskId: task.taskId, eventId,
        actionId: text(agency.actionId, 'agency.actionId', 256), intent: text(agency.intent, 'agency.intent'),
        commandKind: text(agency.commandKind, 'agency.commandKind', 128), commandFingerprint: text(agency.commandFingerprint, 'agency.commandFingerprint', 256),
        expectedEffect: text(agency.expectedEffect, 'agency.expectedEffect'), claimedEffect: text(agency.claimedEffect ?? agency.actualEffect, 'agency.claimedEffect'),
        observedAtMs: Number(this.clock()),
        claims: { rawCommandStored: false, effectVerificationReceiptRequired: true, learningEligible: false },
      }));
      effects.agencyClaim = claim.receiptSha256;
    }
    return this.#record(signed({ schema: 'forge.cognitive-observation.v1', taskId: task.taskId, eventId, type, effects }));
  }

  propose(taskId, input = {}) {
    this.#assertOpen();
    const task = this.#task(taskId);
    const selection = this.selector.select(input);
    if (!selection.selected) {
      return this.#record(signed({
        schema: 'forge.cognitive-abstention.v1', taskId: task.taskId, decision: 'abstain',
        selectionReceiptSha256: selection.receiptSha256, uncertainty: selection.uncertainty,
        rejectedActionIds: selection.ranked.filter((item) => !item.eligible).map((item) => item.id),
        reasonCodes: [...new Set(selection.ranked.map((item) => item.rejectedReason).filter(Boolean))],
        createdAtMs: Number(this.clock()),
      }));
    }
    const proposalId = `proposal-${++this.sequence}`;
    const proposal = signed({
      schema: 'forge.cognitive-proposal.v1', proposalId, taskId: task.taskId,
      selectedActionId: selection.selected?.id ?? null,
      selectedActionKind: selection.selected?.kind ?? null,
      selectionReceiptSha256: selection.receiptSha256,
      uncertainty: selection.uncertainty,
      createdAtMs: Number(this.clock()),
    });
    task.proposals.set(proposalId, proposal);
    while (task.proposals.size > 128) task.proposals.delete(task.proposals.keys().next().value);
    return this.#record(proposal);
  }

  verify(taskId, proposalId, verification = {}) {
    this.#assertOpen();
    const task = this.#task(taskId);
    const proposal = task.proposals.get(text(proposalId, 'proposalId', 256));
    if (!proposal) throw new RangeError(`unknown proposal: ${proposalId}`);
    const verifiedProposalId = `verified-${++this.sequence}`;
    const effectVerification = this.effectVerifier.verify({
      toolRunReceiptSha256: verification.toolRunReceiptSha256,
      declaredSuccess: verification.declaredSuccess === true,
      expectedEffect: verification.expectedEffect ?? {},
      actualEffect: verification.actualEffect ?? {},
      probes: verification.effectProbes ?? [],
    });
    const verified = signed({
      schema: 'forge.verified-cognitive-proposal.v1', verifiedProposalId, taskId: task.taskId,
      proposalId: proposal.proposalId, selectedActionId: proposal.selectedActionId,
      verificationProbeId: text(verification.verificationProbeId, 'verificationProbeId', 256),
      scope: boundedClone(verification.scope ?? {}),
      expectedEffect: boundedClone(verification.expectedEffect ?? {}),
      actualEffect: boundedClone(verification.actualEffect ?? {}),
      verification: boundedClone(verification.verification ?? {}),
      effectVerification,
      blockedInvariantIds: Array.isArray(verification.blockedInvariantIds) ? verification.blockedInvariantIds.map((item) => text(item, 'blockedInvariantIds[]', 256)).slice(0, 128) : [],
      rollbackPoint: text(verification.rollbackPoint, 'rollbackPoint', 512),
      agency: verification.agency ? boundedClone(verification.agency) : null,
      verifiedAtMs: Number(this.clock()),
    });
    task.verified.set(verifiedProposalId, verified);
    while (task.verified.size > 128) task.verified.delete(task.verified.keys().next().value);
    return this.#record(verified);
  }

  commit(taskId, verifiedProposalId) {
    this.#assertOpen();
    const task = this.#task(taskId);
    const verified = task.verified.get(text(verifiedProposalId, 'verifiedProposalId', 256));
    if (!verified) throw new RangeError(`unknown verified proposal: ${verifiedProposalId}`);
    const previous = task.committed.get(verified.verifiedProposalId);
    if (previous) return previous;
    if (verified.effectVerification.status === 'false_success' || verified.effectVerification.status === 'inconclusive') {
      return this.#record(signed({
        schema: 'forge.cognitive-commit-result.v1', taskId: task.taskId, verifiedProposalId: verified.verifiedProposalId,
        allowed: false,
        reasons: [verified.effectVerification.status === 'false_success' ? 'tool-effect-false-success' : 'tool-effect-inconclusive'],
        gateReceiptSha256: verified.effectVerification.receiptSha256,
        effectVerificationReceiptSha256: verified.effectVerification.receiptSha256,
        episodeId: null,
      }));
    }
    const actionGate = this.contexts.canCommitAction(task.taskId);
    const durableMemoryGate = this.contexts.canWriteDurableMemory(task.taskId);
    const dominantHypothesis = this.hypotheses.dominant(task.taskId);
    const gate = evaluateCommitGate({
      actionGate,
      dominantHypothesis,
      scope: verified.scope,
      limits: this.commitLimits,
      verificationProbeId: verified.verificationProbeId,
      blockedInvariantIds: verified.blockedInvariantIds,
    });
    if (!gate.allowed) return this.#record(signed({
      schema: 'forge.cognitive-commit-result.v1', taskId: task.taskId, verifiedProposalId: verified.verifiedProposalId,
      allowed: false, reasons: [...gate.reasons], gateReceiptSha256: gate.receiptSha256,
      actionGateReceiptSha256: actionGate.receiptSha256, durableMemoryGateReceiptSha256: durableMemoryGate.receiptSha256, episodeId: null,
    }));
    const hypothesisSnapshot = this.hypotheses.snapshot(task.taskId);
    const episodeId = `episode-${++this.sequence}`;
    const latestErrorRoute = task.recentErrorRoutes[0];
    const episode = this.episodes.bind({
      episodeId, taskId: task.taskId, contextBefore: this.contexts.snapshot(task.taskId).receiptSha256,
      goal: task.goal, observations: task.observations.length ? task.observations : ['no-observation-id'],
      hypothesesConsidered: hypothesisSnapshot.hypotheses.map((item) => item.id),
      actionId: verified.selectedActionId ?? verified.proposalId,
      expectedEffect: verified.expectedEffect, actualEffect: verified.actualEffect,
      errorAttribution: latestErrorRoute?.errorPosterior ?? {}, rollbackPoint: verified.rollbackPoint,
      verification: verified.verification, lessonStatus: 'unconsolidated',
    });
    task.episodeIds.push(episodeId);
    if (verified.agency && verified.effectVerification.status === 'verified') {
      this.agency.record({
        ...verified.agency,
        taskId: task.taskId,
        claimedEffect: verified.agency.claimedEffect ?? verified.agency.actualEffect,
        verifiedEffect: verified.agency.verifiedEffect ?? verified.agency.actualEffect,
        effectVerificationReceiptSha256: verified.effectVerification.receiptSha256,
        observationAtMs: verified.verifiedAtMs,
        causalAttributionStatus: verified.agency.causalAttributionStatus ?? 'inconclusive',
      });
    }
    const result = signed({
      schema: 'forge.cognitive-commit-result.v1', taskId: task.taskId, verifiedProposalId: verified.verifiedProposalId,
      allowed: true, reasons: [], gateReceiptSha256: gate.receiptSha256, episodeId,
      actionGateReceiptSha256: actionGate.receiptSha256, durableMemoryGateReceiptSha256: durableMemoryGate.receiptSha256,
      episodeReceiptSha256: episode.receiptSha256, effectVerificationReceiptSha256: verified.effectVerification.receiptSha256,
    });
    task.committed.set(verified.verifiedProposalId, result);
    return this.#record(result);
  }

  rollback(taskId, receiptId) {
    this.#assertOpen();
    const task = this.#task(taskId);
    const receipt = signed({ schema: 'forge.cognitive-rollback.v1', taskId: task.taskId, targetReceiptId: text(receiptId, 'receiptId', 512), rolledBackAtMs: Number(this.clock()) });
    task.rollbackReceipts.push(receipt.receiptSha256);
    return this.#record(receipt);
  }

  evaluateStop(taskId, input = {}) { this.#task(taskId); return evaluateStopGate(input); }

  get causalInterventionLab() { this.#assertOpen(); return this._causalInterventionLab ??= new CausalInterventionLab(); }
  runCausalIntervention(input) { return this.causalInterventionLab.run(input); }

  snapshot(taskId = null) {
    if (taskId === null || taskId === undefined) {
      return signed({
        schema: 'forge.cognitive-kernel-snapshot.v1', closed: this.closed, taskCount: this.tasks.size,
        taskIds: [...this.tasks.keys()].slice(0, this.maxTasks), receiptCount: this.receipts.length,
        claims: { chainOfThoughtStored: false, rawPromptsStored: false, sourceFilesMutatedDirectly: false, causalInterventionLoaded: this._causalInterventionLab !== null },
      });
    }
    const task = this.#task(taskId);
    const context = this.contexts.snapshot(task.taskId);
    const hypotheses = this.hypotheses.snapshot(task.taskId);
    return signed({
      schema: 'forge.cognitive-task-snapshot.v1', taskId: task.taskId, goal: task.goal,
      contextPosterior: context, hypothesisPopulation: hypotheses,
      memoryWriteGate: this.contexts.canWriteDurableMemory(task.taskId),
      actionCommitGate: this.contexts.canCommitAction(task.taskId),
      recentErrorRoutes: task.recentErrorRoutes.map((route) => ({ primarySubsystem: route.primarySubsystem, ownerMask: [...route.ownerMask], receiptSha256: route.receiptSha256 })),
      proposalCount: task.proposals.size, verifiedProposalCount: task.verified.size, committedProposalCount: task.committed.size, episodeCount: task.episodeIds.length,
      recoveryLeaseId: task.recoveryLease.leaseId,
      claims: { chainOfThoughtStored: false, rawPromptsStored: false, directFileMutation: false, durableMemoryWritesGated: true, causalInterventionLoaded: this._causalInterventionLab !== null },
    });
  }

  close() { this.closed = true; return this.snapshot(); }

  #record(receipt) {
    this.receipts.push(receipt);
    while (this.receipts.length > this.maxReceipts) this.receipts.shift();
    return receipt;
  }
  #task(taskId) {
    const id = text(taskId, 'taskId', 256);
    const task = this.tasks.get(id);
    if (!task) throw new RangeError(`unknown cognitive task: ${id}`);
    return task;
  }
  #assertOpen() { if (this.closed) throw new Error('Cognitive Kernel is closed'); }
}
