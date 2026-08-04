import test from 'node:test';
import assert from 'node:assert/strict';
import { ScientificBenchmarkHarness } from '../src/small-model/scientific-benchmark-harness.mjs';

const run = (name, { parameters = 100, flops = 1000, successes = [1, 0, 1], quality = [0.9, 0.6, 0.8], repositories = ['held-a', 'held-b', 'held-c'] } = {}) => ({
  name,
  parameters,
  flops,
  observations: successes.map((success, index) => ({
    seed: index + 1,
    taskId: `task-${index + 1}`,
    repositoryId: repositories[index],
    tuned: false,
    success,
    quality: quality[index],
    actionErrors: success ? 0 : 1,
  })),
});

test('ScientificBenchmarkHarness runs matched same-FLOP and same-parameter ablations on independent held-out cohorts', () => {
  const harness = new ScientificBenchmarkHarness();
  const sameFlop = harness.runAblation({
    mode: 'same-flop', independent: true, heldOut: true,
    baseline: run('non-looped', { parameters: 200, flops: 1000 }),
    candidate: run('looped', { parameters: 100, flops: 1000, successes: [1, 1, 1], quality: [0.9, 0.8, 0.9] }),
  });
  assert.equal(sameFlop.matchedBudget, true);
  assert.equal(sameFlop.candidate.successRate, 1);
  assert.equal(sameFlop.claimAllowed, false);
  assert.match(sameFlop.receiptSha256, /^[a-f0-9]{64}$/);

  const sameParameter = harness.runAblation({
    mode: 'same-parameter', independent: true, heldOut: true,
    baseline: run('non-looped', { parameters: 100, flops: 800 }),
    candidate: run('looped', { parameters: 100, flops: 1200 }),
  });
  assert.equal(sameParameter.matchedBudget, true);
  assert.throws(() => harness.runAblation({
    mode: 'same-flop', independent: true, heldOut: true,
    baseline: run('a', { flops: 1000 }), candidate: run('b', { flops: 1200 }),
  }), /same-FLOP/i);
});

test('ScientificBenchmarkHarness rejects non-independent, tuned, contaminated or unmatched cohorts', () => {
  const harness = new ScientificBenchmarkHarness();
  assert.throws(() => harness.runAblation({ mode: 'same-flop', independent: false, heldOut: true, baseline: run('a'), candidate: run('b') }), /independent/i);
  const tuned = run('b'); tuned.observations[0].tuned = true;
  assert.throws(() => harness.runAblation({ mode: 'same-flop', independent: true, heldOut: true, baseline: run('a'), candidate: tuned }), /untuned/i);
  const mismatch = run('b'); mismatch.observations[0].taskId = 'other';
  assert.throws(() => harness.runAblation({ mode: 'same-flop', independent: true, heldOut: true, baseline: run('a'), candidate: mismatch }), /cohort/i);
});

test('ScientificBenchmarkHarness gates quantization stability against held-out action and quality regressions', () => {
  const harness = new ScientificBenchmarkHarness();
  const stable = harness.gateQuantizationStability({
    independent: true, heldOut: true, maxQualityDrop: 0.03, maxActionErrorIncrease: 0.05,
    reference: run('fp16', { quality: [0.9, 0.8, 0.9], successes: [1, 1, 1] }),
    quantized: run('int4', { quality: [0.89, 0.79, 0.89], successes: [1, 1, 1] }),
  });
  assert.equal(stable.allowed, true);
  assert.equal(stable.qualityDrop <= 0.03, true);
  const unstable = harness.gateQuantizationStability({
    independent: true, heldOut: true, maxQualityDrop: 0.03, maxActionErrorIncrease: 0.05,
    reference: run('fp16', { quality: [0.9, 0.8, 0.9], successes: [1, 1, 1] }),
    quantized: run('int2', { quality: [0.5, 0.4, 0.5], successes: [0, 0, 1] }),
  });
  assert.equal(unstable.allowed, false);
  assert.deepEqual([...unstable.findings].sort(), ['action-error-regression', 'quality-regression']);
});

test('ScientificBenchmarkHarness requires repository-disjoint OOD transfer and reports multi-seed variance', () => {
  const harness = new ScientificBenchmarkHarness();
  const result = harness.benchmarkOodTransfer({
    independent: true,
    trainingRepositories: ['train-a', 'train-b'],
    baseline: run('baseline', { repositories: ['ood-a', 'ood-b', 'ood-c'] }),
    candidate: run('candidate', { repositories: ['ood-a', 'ood-b', 'ood-c'], successes: [1, 1, 1] }),
  });
  assert.equal(result.repositoryDisjoint, true);
  assert.equal(result.seeds, 3);
  assert.equal(Number.isFinite(result.candidate.successStdDev), true);
  assert.throws(() => harness.benchmarkOodTransfer({
    independent: true, trainingRepositories: ['ood-a'],
    baseline: run('a', { repositories: ['ood-a', 'ood-b', 'ood-c'] }),
    candidate: run('b', { repositories: ['ood-a', 'ood-b', 'ood-c'] }),
  }), /disjoint/i);
});

test('ScientificBenchmarkHarness compares total-system cost only at matched quality and safety', () => {
  const harness = new ScientificBenchmarkHarness();
  const result = harness.benchmarkSameQualityCost({
    independent: true, heldOut: true, qualityTolerance: 0.02,
    baseline: { name: 'large', quality: 0.91, safetyViolations: 0, successRate: 0.9, tokens: 10000, flops: 50000, rssMbSeconds: 8000, wallMs: 20000, humanCorrections: 1 },
    candidate: { name: 'small-system', quality: 0.9, safetyViolations: 0, successRate: 0.9, tokens: 3000, flops: 15000, rssMbSeconds: 2500, wallMs: 12000, humanCorrections: 1 },
  });
  assert.equal(result.comparable, true);
  assert.equal(result.totalCostRatio < 1, true);
  assert.equal(result.claimAllowed, false);
  assert.throws(() => harness.benchmarkSameQualityCost({
    independent: true, heldOut: true, qualityTolerance: 0.02,
    baseline: { name: 'a', quality: 0.9, safetyViolations: 0, successRate: 0.9, tokens: 1, flops: 1, rssMbSeconds: 1, wallMs: 1, humanCorrections: 0 },
    candidate: { name: 'b', quality: 0.7, safetyViolations: 0, successRate: 0.7, tokens: 1, flops: 1, rssMbSeconds: 1, wallMs: 1, humanCorrections: 0 },
  }), /same-quality/i);
});
