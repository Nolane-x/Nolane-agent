import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveComputeGovernor } from '../src/small-model/adaptive-compute-governor.mjs';
import { SpeculativeBranchLedger } from '../src/small-model/speculative-branch-ledger.mjs';

test('AdaptiveComputeGovernor changes budgets by difficulty, uncertainty and risk', () => {
  const g = new AdaptiveComputeGovernor();
  const easy = g.allocate({ difficulty: 0.1, uncertainty: 0.1, risk: 0.1, profile: 'balanced' });
  const hard = g.allocate({ difficulty: 0.9, uncertainty: 0.9, risk: 0.8, profile: 'balanced' });
  assert.ok(hard.contextTokens > easy.contextTokens);
  assert.ok(hard.verifierBudget > easy.verifierBudget);
  assert.equal(hard.escalationRequired, true);
});

test('AdaptiveComputeGovernor Lite profile stays local and bounded', () => {
  const g = new AdaptiveComputeGovernor();
  const result = g.allocate({ difficulty: 1, uncertainty: 1, risk: 1, profile: 'lite' });
  assert.equal(result.modelTier, 'local-small');
  assert.equal(result.escalationRequired, false);
  assert.ok(result.contextTokens <= 4096);
  assert.ok(result.kvCacheMb <= 512);
});

test('AdaptiveComputeGovernor uses Pareto routing, saturation and RSS-time attribution', () => {
  const g = new AdaptiveComputeGovernor();
  const route = g.chooseRoute([
    { id: 'large', quality: 0.91, cost: 10, risk: 0.1 },
    { id: 'small', quality: 0.9, cost: 2, risk: 0.1 },
  ], { qualityTolerance: 0.02 });
  assert.equal(route.id, 'small');
  assert.equal(g.shouldContinue({ gains: [0.1, 0.01, 0.001], costs: [1, 1, 1] }), false);
  assert.equal(g.recordUsage({ actionId: 'a1', rssMb: 100, durationSeconds: 3 }).rssMbSeconds, 300);
});

test('SpeculativeBranchLedger accepts only reversible side-effect-free preparation', () => {
  const ledger = new SpeculativeBranchLedger();
  ledger.open({ id: 'b1', predictedObservation: 'tests fail' });
  ledger.record('b1', { type: 'prefetch', reversible: true, sideEffect: false });
  assert.throws(() => ledger.record('b1', { type: 'delete', reversible: false, sideEffect: true }), /irreversible/i);
  assert.equal(ledger.resolve('b1', { actualObservation: 'tests pass' }).status, 'discarded');
});
