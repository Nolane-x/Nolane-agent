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
