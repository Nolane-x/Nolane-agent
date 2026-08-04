import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifierMesh } from '../src/small-model/verifier-mesh.mjs';
import { paretoRankCandidates } from '../src/small-model/candidate-ranker.mjs';

test('VerifierMesh requires scoped read-only independent verifiers and records reliability', () => {
  const mesh = new VerifierMesh();
  assert.throws(() => mesh.register({ id: 'weak' }), /soundnessScope/);
  mesh.register({ id: 'tests', soundnessScope: ['unit-tests'], readOnly: true, independent: true, reliability: { falsePositive: 0.01, falseNegative: 0.02 }, evaluate: () => ({ pass: true }) });
  assert.equal(mesh.snapshot().verifiers, 1);
});

test('VerifierMesh computes evidence-derived process reward and mutation strength receipt', async () => {
  const mesh = new VerifierMesh();
  mesh.register({ id: 'tests', soundnessScope: ['unit-tests'], readOnly: true, independent: true, evaluate: async () => ({ pass: true, informationGain: 2, criterionDelta: 1, mutationKilled: 6, mutationTotal: 6 }) });
  const result = await mesh.verify({ candidateId: 'c1', expectedEffect: { criterionDelta: 1 }, observations: {} });
  assert.equal(result.status, 'pass');
  assert.equal(result.mutationStrength, 1);
  assert.ok(result.processReward > 0);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('VerifierMesh surfaces disagreement instead of majority-hiding it', async () => {
  const mesh = new VerifierMesh();
  mesh.register({ id: 'a', soundnessScope: ['syntax'], readOnly: true, independent: true, evaluate: () => ({ pass: true }) });
  mesh.register({ id: 'b', soundnessScope: ['security'], readOnly: true, independent: true, evaluate: () => ({ pass: false, risk: 2 }) });
  const result = await mesh.verify({ candidateId: 'c1', expectedEffect: {}, observations: {} });
  assert.equal(result.status, 'disagreement');
  assert.equal(result.decisions.length, 2);
});

test('candidate ranking preserves Pareto vectors before scalar tie-breaks', () => {
  const ranked = paretoRankCandidates([
    { id: 'safe', quality: 0.9, cost: 4, risk: 0.1 },
    { id: 'dominated', quality: 0.8, cost: 8, risk: 0.2 },
    { id: 'cheap', quality: 0.88, cost: 1, risk: 0.1 },
  ]);
  assert.equal(ranked.find((x) => x.id === 'dominated').pareto, false);
  assert.deepEqual(ranked.filter((x) => x.pareto).map((x) => x.id).sort(), ['cheap', 'safe']);
});
