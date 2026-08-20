import test from 'node:test';
import assert from 'node:assert/strict';
import { CognitiveProposalLifecycle } from '../src/cognition/cognitive-proposal-lifecycle.mjs';

const digest = (character) => character.repeat(64);

function startReceipt(taskId = 'task-1') {
  return {
    schema: 'forge.cognitive-task-start.v1',
    taskId,
    goal: 'Diagnose the failing provider handoff.',
    receiptSha256: digest('a'),
  };
}

function observationReceipt(taskId = 'task-1', eventId = 'event-1') {
  return {
    schema: 'forge.cognitive-observation.v1',
    taskId,
    eventId,
    type: 'evidence',
    receiptSha256: digest('b'),
  };
}

function proposalReceipt(taskId = 'task-1', proposalId = 'proposal-1') {
  return {
    schema: 'forge.cognitive-proposal.v1',
    taskId,
    proposalId,
    selectedActionId: 'inspect-runtime-log',
    receiptSha256: digest('c'),
  };
}

function verificationReceipt(taskId = 'task-1', proposalId = 'proposal-1', verifiedProposalId = 'verified-1') {
  return {
    schema: 'forge.verified-cognitive-proposal.v1',
    taskId,
    proposalId,
    verifiedProposalId,
    receiptSha256: digest('d'),
  };
}

function commitReceipt(taskId = 'task-1', verifiedProposalId = 'verified-1', allowed = true) {
  return {
    schema: 'forge.cognitive-commit-result.v1',
    taskId,
    verifiedProposalId,
    allowed,
    reasons: allowed ? [] : ['tool-effect-inconclusive'],
    receiptSha256: digest(allowed ? 'e' : 'f'),
  };
}

test('CognitiveProposalLifecycle joins task evidence through a committed cognitive decision without claiming execution', () => {
  const lifecycle = new CognitiveProposalLifecycle();
  lifecycle.start(startReceipt(), { atMs: 100 });
  lifecycle.observe(observationReceipt(), { atMs: 101 });
  lifecycle.propose(proposalReceipt(), { atMs: 102 });
  lifecycle.verify(verificationReceipt(), { atMs: 103 });
  lifecycle.settle(commitReceipt(), { atMs: 104 });

  const snapshot = lifecycle.snapshot('task-1');
  assert.equal(snapshot.taskId, 'task-1');
  assert.equal(snapshot.startedAtMs, 100);
  assert.equal(snapshot.observations[0].observedAtMs, 101);
  assert.equal(snapshot.decisions.length, 1);
  assert.deepEqual(snapshot.decisions[0], {
    proposalId: 'proposal-1',
    taskId: 'task-1',
    selectedActionId: 'inspect-runtime-log',
    proposalReceiptSha256: digest('c'),
    observedEventIds: ['event-1'],
    proposedAtMs: 102,
    status: 'committed',
    verifiedProposalId: 'verified-1',
    verificationReceiptSha256: digest('d'),
    verifiedAtMs: 103,
    commitReceiptSha256: digest('e'),
    settledAtMs: 104,
    executionClaimed: false,
    observedToolEffectClaimed: false,
  });
});

test('CognitiveProposalLifecycle rejects out-of-order, cross-task, duplicate, and re-settled receipts', () => {
  const lifecycle = new CognitiveProposalLifecycle();
  lifecycle.start(startReceipt(), { atMs: 100 });

  assert.throws(() => lifecycle.verify(verificationReceipt(), { atMs: 101 }), RangeError);

  lifecycle.propose(proposalReceipt(), { atMs: 102 });
  assert.throws(() => lifecycle.propose(proposalReceipt(), { atMs: 103 }), RangeError);
  assert.throws(() => lifecycle.verify(verificationReceipt('task-2'), { atMs: 104 }), RangeError);

  lifecycle.verify(verificationReceipt(), { atMs: 105 });
  lifecycle.settle(commitReceipt(), { atMs: 106 });
  assert.throws(() => lifecycle.settle(commitReceipt(), { atMs: 107 }), RangeError);
});

test('CognitiveProposalLifecycle marks a denied cognitive gate as rejected without inventing an execution outcome', () => {
  const lifecycle = new CognitiveProposalLifecycle();
  lifecycle.start(startReceipt(), { atMs: 100 });
  lifecycle.propose(proposalReceipt(), { atMs: 101 });
  lifecycle.verify(verificationReceipt(), { atMs: 102 });
  lifecycle.settle(commitReceipt('task-1', 'verified-1', false), { atMs: 103 });

  const [decision] = lifecycle.snapshot('task-1').decisions;
  assert.equal(decision.status, 'rejected');
  assert.equal(decision.executionClaimed, false);
  assert.equal(decision.observedToolEffectClaimed, false);
  assert.deepEqual(decision.reasons, ['tool-effect-inconclusive']);
});
