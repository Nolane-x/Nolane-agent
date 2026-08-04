import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeState } from '../src/small-model/hashed-feature-encoder.mjs';
import { trainLinearPolicy, scoreLinearPolicy } from '../src/small-model/linear-policy-trainer.mjs';

function examples() {
  const values = [];
  for (let i = 0; i < 20; i += 1) {
    values.push({ state: { phase: 'discovery', hasCandidate: false, failingTests: 0, allCriteriaVerified: false, objective: `find symbol ${i}` }, action: { type: 'search' } });
    values.push({ state: { phase: 'verification', hasCandidate: true, patchReady: true, failingTests: 0, allCriteriaVerified: false, objective: `verify patch ${i}` }, action: { type: 'test' } });
    values.push({ state: { phase: 'completion', hasCandidate: true, patchReady: true, failingTests: 0, allCriteriaVerified: true, objective: `finish mission ${i}` }, action: { type: 'stop' } });
  }
  return values;
}

test('hashed feature encoder is deterministic, bounded and distinguishes typed state', () => {
  const first = encodeState({ phase: 'search', count: 2, ready: false, objective: 'find parser' }, { dimensions: 128 });
  const second = encodeState({ phase: 'search', count: 2, ready: false, objective: 'find parser' }, { dimensions: 128 });
  const other = encodeState({ phase: 'test', count: 0, ready: true, objective: 'run tests' }, { dimensions: 128 });
  assert.deepEqual([...first], [...second]);
  assert.equal(first.length, 128);
  assert.equal([...first].every(Number.isFinite), true);
  assert.notDeepEqual([...first], [...other]);
  assert.equal(first[0], 1);
});

test('linear policy trainer performs real optimization deterministically and learns separable actions', () => {
  const first = trainLinearPolicy({ examples: examples(), dimensions: 128, epochs: 80, learningRate: 0.15, seed: 'trainer-test' });
  const second = trainLinearPolicy({ examples: examples(), dimensions: 128, epochs: 80, learningRate: 0.15, seed: 'trainer-test' });
  assert.deepEqual(first.weights, second.weights);
  assert.equal(first.training.lossHistory.at(-1) < first.training.lossHistory[0], true);
  const result = scoreLinearPolicy(first, examples());
  assert.equal(result.accuracy >= 0.98, true);
  assert.equal(result.total, 60);
  assert.deepEqual(first.labels, ['search','stop','test']);
});

test('linear policy trainer rejects hidden reasoning and invalid training configuration', () => {
  assert.throws(() => trainLinearPolicy({ examples: [{ state: { chainOfThought: 'secret' }, action: { type: 'search' } }] }), /hidden reasoning/i);
  assert.throws(() => trainLinearPolicy({ examples: examples(), dimensions: 7 }), /dimensions/i);
});

test('linear policy trainer accepts verified examples that explicitly record hidden reasoning was not stored', () => {
  const values = examples().map((item, index) => ({ ...item, id: `verified-${index}`, hiddenChainOfThoughtStored: false }));
  const model = trainLinearPolicy({ examples: values, dimensions: 64, epochs: 10, learningRate: 0.1, seed: 'verified-example' });
  assert.equal(model.training.examples, values.length);
});
