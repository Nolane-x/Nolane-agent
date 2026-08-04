import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextPosteriorManager } from '../src/cognition/context-posterior-manager.mjs';

test('concentrates posterior after discriminating evidence and gates memory writes', () => {
  const manager = new ContextPosteriorManager({
    maxContexts: 5,
    maxNormalizedEntropyForMemory: 0.45,
    minLeaderProbabilityForMemory: 0.7,
  });
  manager.start('task-1', [
    { id: 'regression', probability: 0.5, claim: 'production regression' },
    { id: 'environment', probability: 0.5, claim: 'environment failure' },
  ]);
  assert.equal(manager.canWriteDurableMemory('task-1').allowed, false);
  manager.observe('task-1', {
    supports: ['regression'],
    contradicts: ['environment'],
    supportLikelihood: 4,
    contradictionLikelihood: 0.25,
    evidenceId: 'ev-1',
  });
  const snapshot = manager.snapshot('task-1');
  assert.equal(snapshot.contexts[0].id, 'regression');
  assert.ok(snapshot.contexts[0].probability >= 0.9);
  assert.ok(snapshot.normalizedEntropy < 0.45);
  assert.equal(manager.canWriteDurableMemory('task-1').allowed, true);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
});

test('rejects unknown context evidence and keeps bounded immutable snapshots', () => {
  const manager = new ContextPosteriorManager({ maxContexts: 2 });
  manager.start('task-2', [
    { id: 'a', probability: 0.6 },
    { id: 'b', probability: 0.3 },
    { id: 'c', probability: 0.1 },
  ]);
  assert.equal(manager.snapshot('task-2').contexts.length, 2);
  assert.throws(() => manager.observe('task-2', { supports: ['missing'], evidenceId: 'ev-x' }), /unknown context/i);
  assert.equal(Object.isFrozen(manager.snapshot('task-2')), true);
});
