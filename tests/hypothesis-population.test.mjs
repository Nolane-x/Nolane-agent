import test from 'node:test';
import assert from 'node:assert/strict';
import { HypothesisPopulation } from '../src/cognition/hypothesis-population.mjs';

function hypotheses() {
  return [
    { id: 'h1', claim: 'cache invalidation', probability: 0.5, predictions: ['cache-off passes'], falsificationCondition: 'cache-off still fails', testCost: 1 },
    { id: 'h2', claim: 'expiration units', probability: 0.35, predictions: ['short ttl fails'], falsificationCondition: 'milliseconds are correct', testCost: 2 },
    { id: 'h3', claim: 'fixture clock', probability: 0.15, predictions: ['real clock passes'], falsificationCondition: 'fixture matches runtime', testCost: 1 },
  ];
}

test('keeps up to three hypotheses with evidence and preserves alternatives until falsified', () => {
  const population = new HypothesisPopulation({ maxActive: 3 });
  population.start('task-1', [...hypotheses(), { id: 'h4', claim: 'noise', probability: 0.01, predictions: ['none'], falsificationCondition: 'none', testCost: 9 }]);
  let snapshot = population.snapshot('task-1');
  assert.deepEqual(snapshot.hypotheses.map((item) => item.id), ['h1', 'h2', 'h3']);
  population.observe('task-1', { evidenceId: 'ev-1', supports: ['h2'], contradicts: ['h1'], supportLikelihood: 3, contradictionLikelihood: 0.4 });
  snapshot = population.snapshot('task-1');
  assert.equal(snapshot.hypotheses[0].id, 'h2');
  assert.ok(snapshot.hypotheses.some((item) => item.id === 'h1' && item.status === 'active'));
  assert.deepEqual(snapshot.hypotheses.find((item) => item.id === 'h2').supportEvidence, ['ev-1']);
  assert.deepEqual(snapshot.hypotheses.find((item) => item.id === 'h1').counterEvidence, ['ev-1']);
  population.falsify('task-1', 'h1', 'ev-2');
  assert.equal(population.snapshot('task-1').hypotheses.find((item) => item.id === 'h1').status, 'falsified');
  assert.equal(population.dominant('task-1').id, 'h2');
});

test('requires predictions and a falsification condition', () => {
  const population = new HypothesisPopulation();
  assert.throws(() => population.start('task-x', [{ id: 'h', claim: 'bad', probability: 1 }]), /predictions/i);
});
