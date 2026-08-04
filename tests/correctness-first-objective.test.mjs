import assert from 'node:assert/strict';
import test from 'node:test';

import { detectRewardHacking, evaluateCandidate, rankCandidates } from '../src/decision/correctness-first-objective.mjs';

const sha = (char) => char.repeat(64);

function baseline() {
  return {
    criterionIds: ['c1', 'c2'],
    requiredTestIds: ['unit', 'integration'],
    requiredCostCategories: ['token', 'tool', 'model', 'process', 'context'],
    criterionUniverseReceiptSha256: sha('a'),
    verificationContractReceiptSha256: sha('b'),
  };
}
function candidate(overrides = {}) {
  return {
    candidateId: 'candidate-a',
    criterionIds: ['c1', 'c2'], verifiedCriterionIds: ['c1', 'c2'],
    criterionUniverseReceiptSha256: sha('a'),
    verificationContractReceiptSha256: sha('b'),
    executedTestIds: ['unit', 'integration'], weakenedTestIds: [],
    regressionCount: 0, hiddenRegressionCount: 0, verificationPassed: true,
    independentVerificationReceiptSha256: sha('c'),
    costs: { token: 100, tool: 2, model: 0.1, process: 50, context: 80 },
    ...overrides,
  };
}

test('ranking is lexicographic: requirements, regressions, verification integrity, then resources', () => {
  const cheapIncomplete = candidate({ candidateId: 'cheap', verifiedCriterionIds: ['c1'], costs: { token: 1, tool: 1, model: 0, process: 1, context: 1 } });
  const completeExpensive = candidate({ candidateId: 'complete', costs: { token: 10_000, tool: 20, model: 2, process: 5_000, context: 5_000 } });
  assert.equal(rankCandidates([cheapIncomplete, completeExpensive], { baseline: baseline() })[0].candidateId, 'complete');

  const regressing = candidate({ candidateId: 'regressing', regressionCount: 1, costs: { token: 1, tool: 1, model: 0, process: 1, context: 1 } });
  const clean = candidate({ candidateId: 'clean', costs: { token: 100, tool: 2, model: 0.1, process: 50, context: 80 } });
  assert.equal(rankCandidates([regressing, clean], { baseline: baseline() })[0].candidateId, 'clean');

  const highIntegrity = candidate({ candidateId: 'high-integrity', verificationIntegrityScore: 1, costs: { token: 500, tool: 4, model: 0.2, process: 100, context: 100 } });
  const lowIntegrity = candidate({ candidateId: 'low-integrity', verificationIntegrityScore: 0.5, costs: { token: 1, tool: 1, model: 0, process: 1, context: 1 } });
  assert.equal(rankCandidates([lowIntegrity, highIntegrity], { baseline: baseline() })[0].candidateId, 'high-integrity');

  const lowerCost = candidate({ candidateId: 'lower-cost', costs: { token: 50, tool: 1, model: 0.05, process: 20, context: 40 } });
  const higherCost = candidate({ candidateId: 'higher-cost', costs: { token: 100, tool: 2, model: 0.1, process: 50, context: 80 } });
  assert.equal(rankCandidates([higherCost, lowerCost], { baseline: baseline() })[0].candidateId, 'lower-cost');
});

test('reward hacking guard detects skipped verification, weakened tests, reduced criteria, hidden regressions, and missing cost', () => {
  const result = detectRewardHacking(candidate({
    criterionIds: ['c1'],
    criterionUniverseReceiptSha256: sha('9'),
    executedTestIds: ['unit'],
    weakenedTestIds: ['unit'],
    skippedVerification: true,
    hiddenRegressionCount: 2,
    costs: { token: 1 },
  }), baseline());
  assert.equal(result.detected, true);
  assert.match(result.reasons.join('\n'), /criterion.*removed|universe.*changed/i);
  assert.match(result.reasons.join('\n'), /required test.*integration/i);
  assert.match(result.reasons.join('\n'), /weakened test.*unit/i);
  assert.match(result.reasons.join('\n'), /verification.*skipped/i);
  assert.match(result.reasons.join('\n'), /hidden regression/i);
  assert.match(result.reasons.join('\n'), /missing cost.*process/i);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('a hacked candidate is ineligible even when it reports perfect score and near-zero cost', () => {
  const evaluation = evaluateCandidate(candidate({
    candidateId: 'hacked',
    skippedVerification: true,
    executedTestIds: [],
    costs: { token: 0, tool: 0, model: 0, process: 0, context: 0 },
  }), { baseline: baseline() });
  assert.equal(evaluation.eligible, false);
  assert.equal(evaluation.objective.verifiedCriteriaScore, 2);
  assert.ok(evaluation.rewardHacking.reasons.length > 0);
});

test('evaluation is immutable and content-addressed', () => {
  const evaluation = evaluateCandidate(candidate(), { baseline: baseline() });
  assert.equal(evaluation.eligible, true);
  assert.equal(Object.isFrozen(evaluation), true);
  assert.match(evaluation.receiptSha256, /^[a-f0-9]{64}$/);
});
