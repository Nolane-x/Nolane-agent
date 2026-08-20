import test from 'node:test';
import assert from 'node:assert/strict';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

test('DecisionPlane lazily exposes bounded cognitive operations', () => {
  const plane = new DecisionPlane();
  assert.equal(plane.snapshot().lifecycle.cognitionLoaded, false);
  plane.startCognitiveTask({
    taskId: 'task-1', goal: 'diagnose failure', recoveryLeaseId: 'lease-1',
    contexts: [{ id: 'code', probability: 0.5 }, { id: 'environment', probability: 0.5 }],
    hypotheses: [
      { id: 'h1', claim: 'code regression', probability: 0.6, predictions: ['target test fails'], falsificationCondition: 'target test passes on baseline', testCost: 1 },
      { id: 'h2', claim: 'environment issue', probability: 0.4, predictions: ['binary missing'], falsificationCondition: 'binary exists', testCost: 1 },
    ],
  });
  plane.observeCognitiveEvent('task-1', { eventId: 'ev-1', type: 'evidence', contextEvidence: { evidenceId: 'ev-1', supports: ['code'], contradicts: ['environment'], supportLikelihood: 4, contradictionLikelihood: 0.25 }, hypothesisEvidence: { evidenceId: 'ev-1', supports: ['h1'], contradicts: ['h2'], supportLikelihood: 3, contradictionLikelihood: 0.3 } });
  const proposal = plane.proposeCognitiveAction('task-1', { uncertainty: 0.2, actions: [{ id: 'run-test', kind: 'probe', taskUtility: 0.5, informationGain: 0.9, tokenCost: 10, ramMbSeconds: 2, timeMs: 100, irreversibility: 0 }] });
  assert.equal(proposal.selectedActionId, 'run-test');
  const snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.cognitionLoaded, true);
  assert.equal(snapshot.cognition.taskCount, 1);
  assert.equal(snapshot.claims.chainOfThoughtStored, false);
  plane.close();
});

test('DecisionPlane links successful cognitive receipts into a non-executing proposal lifecycle', () => {
  const plane = new DecisionPlane({ clock: () => 1_000 });
  assert.equal(plane.cognitiveLifecycleSnapshot(), null);

  const started = plane.startCognitiveTask({
    taskId: 'task-lifecycle', missionId: 'mission-lifecycle', goal: 'repair a bounded provider handoff', recoveryLeaseId: 'lease-lifecycle',
    contexts: [{ id: 'regression', probability: 0.99 }, { id: 'environment', probability: 0.01 }],
    hypotheses: [
      { id: 'h1', claim: 'the handoff is misconfigured', probability: 0.99, predictions: ['target test passes after repair'], falsificationCondition: 'target test still fails', testCost: 1 },
      { id: 'h2', claim: 'the environment is the cause', probability: 0.01, predictions: ['reset fixes it'], falsificationCondition: 'reset does not fix it', testCost: 1 },
    ],
  });
  const observed = plane.observeCognitiveEvent('task-lifecycle', {
    eventId: 'event-lifecycle', type: 'evidence',
    contextEvidence: { evidenceId: 'event-lifecycle', supports: ['regression'], contradicts: ['environment'], supportLikelihood: 5, contradictionLikelihood: 0.2 },
    hypothesisEvidence: { evidenceId: 'event-lifecycle', supports: ['h1'], contradicts: ['h2'], supportLikelihood: 5, contradictionLikelihood: 0.2 },
  });
  const proposal = plane.proposeCognitiveAction('task-lifecycle', {
    uncertainty: 0.01,
    actions: [{ id: 'repair-handoff', kind: 'patch', taskUtility: 0.9, informationGain: 0.2, tokenCost: 10, ramMbSeconds: 1, timeMs: 100, irreversibility: 0.05 }],
  });
  const verified = plane.verifyCognitiveProposal('task-lifecycle', proposal.proposalId, {
    verificationProbeId: 'provider-handoff-test', toolRunReceiptSha256: 'a'.repeat(64), declaredSuccess: true,
    effectProbes: [{ probeId: 'provider-handoff-effect', independent: true, receiptSha256: 'b'.repeat(64), paths: ['targetTest'] }],
    scope: { files: 1, changedLines: 1 }, expectedEffect: { targetTest: 'pass' }, actualEffect: { targetTest: 'pass' },
    verification: { targetedTests: 'passed' }, blockedInvariantIds: [], rollbackPoint: 'worktree-base',
  });
  const committed = plane.commitCognitiveProposal('task-lifecycle', verified.verifiedProposalId);
  const repeatedCommit = plane.commitCognitiveProposal('task-lifecycle', verified.verifiedProposalId);

  assert.equal(started.schema, 'forge.cognitive-task-start.v1');
  assert.equal(observed.schema, 'forge.cognitive-observation.v1');
  assert.equal(committed.allowed, true);
  assert.equal(repeatedCommit.receiptSha256, committed.receiptSha256);
  const lifecycle = plane.cognitiveLifecycleSnapshot('task-lifecycle');
  assert.equal(lifecycle.missionId, 'mission-lifecycle');
  assert.equal(lifecycle.startedAtMs, 1_000);
  assert.equal(lifecycle.observations[0].observedAtMs, 1_000);
  assert.equal(lifecycle.decisions[0].status, 'committed');
  assert.equal(lifecycle.decisions[0].proposalReceiptSha256, proposal.receiptSha256);
  assert.equal(lifecycle.decisions[0].verificationReceiptSha256, verified.receiptSha256);
  assert.equal(lifecycle.decisions[0].commitReceiptSha256, committed.receiptSha256);
  assert.equal(lifecycle.decisions[0].executionClaimed, false);
  assert.equal(lifecycle.decisions[0].observedToolEffectClaimed, false);
  assert.equal(plane.snapshot().lifecycle.cognitiveLifecycleLoaded, true);
  assert.equal(plane.snapshot().cognitiveProposalLifecycle.taskCount, 1);
  plane.close();
});

test('DecisionPlane leaves abstentions out of the proposal lifecycle', () => {
  const plane = new DecisionPlane();
  plane.startCognitiveTask({
    taskId: 'task-lifecycle-abstain', goal: 'avoid an irreversible action', recoveryLeaseId: 'lease-lifecycle-abstain',
    contexts: [{ id: 'code', probability: 1 }],
    hypotheses: [{ id: 'h1', claim: 'the action is unsafe', probability: 1, predictions: ['risk remains'], falsificationCondition: 'risk is bounded', testCost: 1 }],
  });

  const abstention = plane.proposeCognitiveAction('task-lifecycle-abstain', {
    uncertainty: 0,
    irreversibilityLimit: 0.2,
    actions: [{ id: 'overwrite-history', kind: 'patch', taskUtility: 1, informationGain: 0, tokenCost: 1, ramMbSeconds: 1, timeMs: 1, irreversibility: 0.200001 }],
  });

  assert.equal(abstention.schema, 'forge.cognitive-abstention.v1');
  assert.equal(plane.cognitiveLifecycleSnapshot('task-lifecycle-abstain').decisions.length, 0);
  plane.close();
});

test('DecisionPlane records a denied cognitive gate as rejected without an execution claim', () => {
  const plane = new DecisionPlane();
  plane.startCognitiveTask({
    taskId: 'task-lifecycle-rejected', goal: 'stop before an inconclusive effect', recoveryLeaseId: 'lease-lifecycle-rejected',
    contexts: [{ id: 'code', probability: 0.5 }, { id: 'environment', probability: 0.5 }],
    hypotheses: [
      { id: 'h1', claim: 'the code is broken', probability: 0.6, predictions: ['target fails'], falsificationCondition: 'target passes', testCost: 1 },
      { id: 'h2', claim: 'the environment is broken', probability: 0.4, predictions: ['binary is absent'], falsificationCondition: 'binary exists', testCost: 1 },
    ],
  });
  const proposal = plane.proposeCognitiveAction('task-lifecycle-rejected', {
    uncertainty: 0.7,
    actions: [{ id: 'inspect-effect', kind: 'read', taskUtility: 0.8, informationGain: 0.2, tokenCost: 10, ramMbSeconds: 1, timeMs: 100, irreversibility: 0 }],
  });
  const verified = plane.verifyCognitiveProposal('task-lifecycle-rejected', proposal.proposalId, {
    verificationProbeId: 'inconclusive-probe', scope: { files: 0, changedLines: 0 }, expectedEffect: {}, actualEffect: {}, verification: {}, blockedInvariantIds: [], rollbackPoint: 'worktree-base',
  });
  const committed = plane.commitCognitiveProposal('task-lifecycle-rejected', verified.verifiedProposalId);

  const [decision] = plane.cognitiveLifecycleSnapshot('task-lifecycle-rejected').decisions;
  assert.equal(committed.allowed, false);
  assert.equal(decision.status, 'rejected');
  assert.equal(decision.executionClaimed, false);
  assert.equal(decision.observedToolEffectClaimed, false);
  plane.close();
});
