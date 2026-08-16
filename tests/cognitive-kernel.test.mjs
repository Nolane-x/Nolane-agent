import test from 'node:test';
import assert from 'node:assert/strict';
import { CognitiveKernel } from '../src/cognition/cognitive-kernel.mjs';

test('runs observe propose verify commit and binds an episode', () => {
  const kernel = new CognitiveKernel({ limits: { maxTasks: 10, maxReceipts: 100 } });
  kernel.startTask({
    taskId: 'task-1', goal: 'fix expired session cache', recoveryLeaseId: 'lease-1',
    contexts: [
      { id: 'regression', probability: 0.5, claim: 'production regression' },
      { id: 'environment', probability: 0.5, claim: 'environment issue' },
    ],
    hypotheses: [
      { id: 'h1', claim: 'cache invalidation', probability: 0.55, predictions: ['cache-off passes'], falsificationCondition: 'cache-off still fails', testCost: 1 },
      { id: 'h2', claim: 'expiration units', probability: 0.45, predictions: ['short ttl fails'], falsificationCondition: 'milliseconds are correct', testCost: 2 },
    ],
  });
  assert.equal(kernel.snapshot('task-1').memoryWriteGate.allowed, false);
  kernel.observe('task-1', {
    eventId: 'ev-1', type: 'evidence',
    contextEvidence: { evidenceId: 'ev-1', supports: ['regression'], contradicts: ['environment'], supportLikelihood: 5, contradictionLikelihood: 0.2 },
    hypothesisEvidence: { evidenceId: 'ev-1', supports: ['h1'], contradicts: ['h2'], supportLikelihood: 4, contradictionLikelihood: 0.25 },
  });
  const proposal = kernel.propose('task-1', {
    uncertainty: 0.15,
    actions: [
      { id: 'patch-cache', kind: 'patch', taskUtility: 0.9, informationGain: 0.5, tokenCost: 300, ramMbSeconds: 10, timeMs: 1000, irreversibility: 0.1 },
      { id: 'read-more', kind: 'read', taskUtility: 0.2, informationGain: 0.2, tokenCost: 2000, ramMbSeconds: 30, timeMs: 5000, irreversibility: 0 },
    ],
  });
  assert.equal(proposal.selectedActionId, 'patch-cache');
  const verified = kernel.verify('task-1', proposal.proposalId, {
    verificationProbeId: 'test-session-cache', toolRunReceiptSha256: 'a'.repeat(64), declaredSuccess: true,
    effectProbes: [{ probeId: 'test-effect', independent: true, receiptSha256: 'b'.repeat(64), paths: ['targetTest', 'publicApi'] }],
    scope: { files: 1, changedLines: 7 },
    expectedEffect: { targetTest: 'pass', publicApi: 'unchanged' },
    actualEffect: { targetTest: 'pass', publicApi: 'unchanged' },
    verification: { targetedTests: 'passed', impactedTests: 'passed' }, blockedInvariantIds: [], rollbackPoint: 'commit-base',
  });
  const committed = kernel.commit('task-1', verified.verifiedProposalId);
  assert.equal(committed.allowed, true);
  assert.equal(committed.episodeId.startsWith('episode-'), true);
  const repeatedCommit = kernel.commit('task-1', verified.verifiedProposalId);
  assert.equal(repeatedCommit.receiptSha256, committed.receiptSha256);
  const snapshot = kernel.snapshot('task-1');
  assert.equal(snapshot.memoryWriteGate.allowed, true);
  assert.equal(snapshot.episodeCount, 1);
  assert.equal(snapshot.claims.chainOfThoughtStored, false);
  assert.match(committed.receiptSha256, /^[a-f0-9]{64}$/);
});

test('denies commit when posterior is dispersed and records routed errors', () => {
  const kernel = new CognitiveKernel();
  kernel.startTask({
    taskId: 'task-2', goal: 'diagnose build', recoveryLeaseId: 'lease-2',
    contexts: [{ id: 'code', probability: 0.5 }, { id: 'environment', probability: 0.5 }],
    hypotheses: [
      { id: 'h1', claim: 'missing binary', probability: 0.6, predictions: ['ENOENT'], falsificationCondition: 'binary exists', testCost: 1 },
      { id: 'h2', claim: 'bad plan', probability: 0.4, predictions: ['binary exists'], falsificationCondition: 'plan succeeds', testCost: 2 },
    ],
  });
  kernel.observe('task-2', { eventId: 'err-1', type: 'error', error: { category: 'missing-binary', code: 'ENOENT' } });
  const proposal = kernel.propose('task-2', { uncertainty: 0.7, actions: [{ id: 'install', kind: 'patch', taskUtility: 0.8, informationGain: 0.2, tokenCost: 20, ramMbSeconds: 0, timeMs: 100, irreversibility: 0.1 }] });
  const verified = kernel.verify('task-2', proposal.proposalId, { verificationProbeId: 'probe', scope: { files: 0, changedLines: 0 }, expectedEffect: {}, actualEffect: {}, verification: {}, blockedInvariantIds: [], rollbackPoint: 'base' });
  const committed = kernel.commit('task-2', verified.verifiedProposalId);
  assert.equal(committed.allowed, false);
  assert.equal(kernel.snapshot('task-2').recentErrorRoutes[0].primarySubsystem, 'execution');
});


test('denies commit when a declared tool success has a mismatched observed effect', () => {
  const kernel = new CognitiveKernel();
  kernel.startTask({
    taskId: 'task-false-success', goal: 'change the target behavior safely', recoveryLeaseId: 'lease-false-success',
    contexts: [{ id: 'code', probability: 0.99 }, { id: 'environment', probability: 0.01 }],
    hypotheses: [
      { id: 'h1', claim: 'target implementation is wrong', probability: 0.99, predictions: ['target test passes'], falsificationCondition: 'target test still fails', testCost: 1 },
      { id: 'h2', claim: 'environment issue', probability: 0.01, predictions: ['environment reset fixes it'], falsificationCondition: 'environment is unchanged', testCost: 2 },
    ],
  });
  const proposal = kernel.propose('task-false-success', {
    uncertainty: 0.01,
    actions: [{ id: 'patch-target', kind: 'patch', taskUtility: 0.9, informationGain: 0.3, tokenCost: 20, ramMbSeconds: 1, timeMs: 100, irreversibility: 0.05 }],
  });
  const verified = kernel.verify('task-false-success', proposal.proposalId, {
    verificationProbeId: 'target-test-probe', toolRunReceiptSha256: 'c'.repeat(64), declaredSuccess: true,
    effectProbes: [{ probeId: 'target-test', independent: true, receiptSha256: 'd'.repeat(64), paths: ['targetTest'] }],
    scope: { files: 1, changedLines: 2 }, expectedEffect: { targetTest: 'pass' }, actualEffect: { targetTest: 'fail' },
    verification: { targetedTests: 'failed' }, blockedInvariantIds: [], rollbackPoint: 'base',
  });
  assert.equal(verified.effectVerification.status, 'false_success');
  const committed = kernel.commit('task-false-success', verified.verifiedProposalId);
  assert.equal(committed.allowed, false);
  assert.deepEqual(committed.reasons, ['tool-effect-false-success']);
});
