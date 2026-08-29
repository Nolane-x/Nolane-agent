import test from 'node:test';
import assert from 'node:assert/strict';

import { runEphemeralCapabilityMechanismBenchmark } from '../scripts/benchmark-ephemeral-capability-composition.mjs';

test('ECC mechanism benchmark exposes orchestration savings without hiding primitive governance work', async () => {
  const report = await runEphemeralCapabilityMechanismBenchmark({ repetitions: 4 });
  assert.equal(report.schema, 'nolane.ecc-mechanism-benchmark.v1');
  assert.equal(report.claimClass, 'mechanism-only-no-intelligence-comparison');

  assert.deepEqual(report.baseline, {
    mode: 'baseline', repetitions: 4, modelRequests: 9, topLevelToolCalls: 8,
    primitiveEffects: 8, budgetToolCalls: 8, receipts: 8, turns: 9,
  });
  assert.deepEqual(report.composite, {
    mode: 'composite', repetitions: 4, modelRequests: 6, topLevelToolCalls: 5,
    primitiveEffects: 8, budgetToolCalls: 13, receipts: 13, turns: 6,
  });
  assert.deepEqual(report.deltas, {
    modelRequestReductionPercent: 33.33,
    topLevelToolCallReductionPercent: 37.5,
    primitiveEffectReductionPercent: 0,
    additionalGovernedBudgetUnits: 5,
    additionalReceipts: 5,
  });
});
