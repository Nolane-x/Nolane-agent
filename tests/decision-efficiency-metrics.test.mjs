import assert from 'node:assert/strict';
import test from 'node:test';

import { DecisionEfficiencyMetrics, computeDecisionEfficiency } from '../src/decision/decision-efficiency-metrics.mjs';

function observation(overrides = {}) {
  return {
    taskId: 'task-1', decisionId: 'decision-1', providerId: 'codex', taskKind: 'debug',
    criterionSnapshot: { totalCriteriaWeight: 7, verifiedCriteriaScore: 4, receiptSha256: 'a'.repeat(64) },
    inputTokens: 3000, outputTokens: 1000, contextTokensSelected: 2500, contextTokensActuallyUseful: 1200,
    rssMbSeconds: 1200, changedLines: 20, changedFiles: 2, semanticFootprint: 4,
    correctionCycles: 1, revertedLines: 5, firstPatchPassed: false, humanInterventions: 0,
    observedAtMs: 100,
    ...overrides,
  };
}

test('computeDecisionEfficiency derives yields only from verified criteria', () => {
  const metrics = computeDecisionEfficiency(observation());
  assert.equal(metrics.verifiedValue, 4);
  assert.equal(metrics.totalTokens, 4000);
  assert.equal(metrics.tokenYield, 1);
  assert.equal(metrics.memoryMbMinutes, 20);
  assert.equal(metrics.memoryYield, 0.2);
  assert.ok(metrics.editYield > 0);
  assert.match(metrics.receiptSha256, /^[a-f0-9]{64}$/);
});

test('computeDecisionEfficiency gives failed criteria zero reward regardless of low cost', () => {
  const metrics = computeDecisionEfficiency(observation({ criterionSnapshot: { totalCriteriaWeight: 7, verifiedCriteriaScore: 0, receiptSha256: 'b'.repeat(64) }, inputTokens: 1, outputTokens: 0, rssMbSeconds: 1, changedLines: 1, semanticFootprint: 1 }));
  assert.equal(metrics.verifiedValue, 0);
  assert.equal(metrics.tokenYield, 0);
  assert.equal(metrics.memoryYield, 0);
  assert.equal(metrics.editYield, 0);
});

test('computeDecisionEfficiency charges reverted lines and correction lineage to edit cost', () => {
  const clean = computeDecisionEfficiency(observation({ correctionCycles: 0, revertedLines: 0, firstPatchPassed: true }));
  const corrected = computeDecisionEfficiency(observation({ correctionCycles: 3, revertedLines: 30, firstPatchPassed: false }));
  assert.ok(corrected.editCostUnits > clean.editCostUnits);
  assert.ok(corrected.editYield < clean.editYield);
  assert.equal(corrected.correctionLineage.correctionCycles, 3);
  assert.equal(corrected.correctionLineage.revertedLines, 30);
});

test('DecisionEfficiencyMetrics keeps a bounded immutable observation journal', () => {
  const store = new DecisionEfficiencyMetrics({ maxEntries: 2 });
  store.record(observation({ taskId: 't1' }));
  store.record(observation({ taskId: 't2' }));
  store.record(observation({ taskId: 't3' }));
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.entries.map((item) => item.taskId), ['t2', 't3']);
  assert.equal(snapshot.summary.samples, 2);
  assert.equal(Object.isFrozen(snapshot), true);
});


test('computeDecisionEfficiency derives hierarchy and context utility from verified outcome receipts', () => {
  const metrics = computeDecisionEfficiency(observation({
    contextTokensSelected: 9999,
    contextTokensActuallyUseful: 9999,
    outcomeSnapshot: {
      decisionId: 'decision-1',
      taskScore: { totalCriteriaWeight: 7, verifiedCriteriaScore: 4, receiptSha256: 'c'.repeat(64) },
      milestoneScore: { totalCriteriaWeight: 12, verifiedCriteriaScore: 6, receiptSha256: 'd'.repeat(64) },
      missionScore: { totalCriteriaWeight: 20, verifiedCriteriaScore: 9, receiptSha256: 'e'.repeat(64) },
      contextUtility: { contextTokensSelected: 2500, contextTokensActuallyUseful: 1200, receiptSha256: 'f'.repeat(64) },
      cost: { byCategory: { token: 4000, process: 1200, context: 2500 }, receiptSha256: '1'.repeat(64) },
    },
  }));
  assert.equal(metrics.decisionId, 'decision-1');
  assert.equal(metrics.contextTokensSelected, 2500);
  assert.equal(metrics.contextTokensActuallyUseful, 1200);
  assert.deepEqual(metrics.verifiedCriteriaHierarchy, { task: 4, milestone: 6, mission: 9 });
  assert.equal(metrics.outcomeReceipts.contextUtility, 'f'.repeat(64));
  assert.equal(metrics.outcomeReceipts.costAttribution, '1'.repeat(64));
});
