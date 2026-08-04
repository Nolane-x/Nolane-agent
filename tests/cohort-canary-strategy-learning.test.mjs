import assert from 'node:assert/strict';
import test from 'node:test';

import { CohortCanaryGovernor } from '../src/learning/cohort-canary-governor.mjs';
import { StrategyPolicyLearner } from '../src/learning/strategy-policy-learner.mjs';

const H = (ch) => ch.repeat(64);

test('CohortCanaryGovernor assigns deterministic cohorts and isolates cohort metrics', () => {
  const governor = new CohortCanaryGovernor({ cohorts: ['small-js', 'large-polyglot'], minSamples: 2 });
  const one = governor.assign({ missionId: 'mission-1', policySha256: H('a'), eligibleCohorts: ['small-js', 'large-polyglot'] });
  const two = governor.assign({ missionId: 'mission-1', policySha256: H('a'), eligibleCohorts: ['large-polyglot', 'small-js'] });
  assert.equal(one.cohort, two.cohort);
  assert.equal(one.productionRoutingChanged, false);

  for (const variant of ['baseline', 'candidate']) {
    governor.record({ cohort: one.cohort, variant, success: true, correctionCycles: 0, rssMbSeconds: 10, verified: true, verificationReceiptSha256: variant === 'baseline' ? H('b') : H('c') });
  }
  const snapshot = governor.snapshot();
  assert.equal(snapshot.cohorts.find((item) => item.cohort === one.cohort).baseline.samples, 1);
  const other = snapshot.cohorts.find((item) => item.cohort !== one.cohort);
  assert.equal(other.baseline.samples, 0);
});

test('CohortCanaryGovernor disables a regressing candidate without promoting production routing', () => {
  const governor = new CohortCanaryGovernor({ cohorts: ['cohort-a'], minSamples: 2, maxPassRateRegression: 0.1, maxCorrectionRegression: 0.5 });
  for (let index = 0; index < 2; index += 1) {
    governor.record({ cohort: 'cohort-a', variant: 'baseline', success: true, correctionCycles: 0, rssMbSeconds: 10, verified: true, verificationReceiptSha256: H('a') });
    governor.record({ cohort: 'cohort-a', variant: 'candidate', success: false, correctionCycles: 2, rssMbSeconds: 10, verified: true, verificationReceiptSha256: H('b') });
  }
  const result = governor.evaluate('cohort-a');
  assert.equal(result.decision, 'disable-regression');
  assert.equal(result.enabled, false);
  assert.equal(result.claims.productionPromotionExecuted, false);
  assert.throws(() => governor.record({ cohort: 'cohort-a', variant: 'candidate', success: true, verified: false, verificationReceiptSha256: H('c') }), /verified outcome/i);
});

test('StrategyPolicyLearner recommends reasoning, tool, retry, and context strategy from verified outcomes', () => {
  const learner = new StrategyPolicyLearner();
  const context = { taskType: 'bugfix', language: 'typescript', riskBand: 'high' };
  learner.recordOutcome({ outcomeId: 'o1', context, strategy: { reasoningEffort: 'high', toolBudget: 12, retryBudget: 2, contextStrategy: 'symbol-first' }, success: true, verifiedUtility: 2, verified: true, verificationReceiptSha256: H('a') });
  learner.recordOutcome({ outcomeId: 'o2', context, strategy: { reasoningEffort: 'low', toolBudget: 4, retryBudget: 0, contextStrategy: 'broad' }, success: false, verifiedUtility: -1, verified: true, verificationReceiptSha256: H('b') });
  const recommendation = learner.recommend(context);
  assert.equal(recommendation.strategy.reasoningEffort, 'high');
  assert.equal(recommendation.strategy.contextStrategy, 'symbol-first');
  assert.equal(recommendation.claims.verifiedOutcomesOnly, true);
  assert.throws(() => learner.recordOutcome({ outcomeId: 'o3', context, strategy: recommendation.strategy, success: true, verified: false, verificationReceiptSha256: H('c') }), /verified outcome/i);
});

test('StrategyPolicyLearner records patch survival only after 7-30 days with verified revert and rewrite evidence', () => {
  const learner = new StrategyPolicyLearner();
  const acceptedAt = Date.UTC(2026, 6, 1);
  assert.throws(() => learner.recordPatchSurvival({ patchId: 'p1', acceptedAt, observedAt: acceptedAt + 6 * 86_400_000, survived: true, reverted: false, humanRewriteRatio: 0, verified: true, verificationReceiptSha256: H('d') }), /7 and 30 days/i);
  const observation = learner.recordPatchSurvival({ patchId: 'p1', acceptedAt, observedAt: acceptedAt + 14 * 86_400_000, survived: false, reverted: true, humanRewriteRatio: 0.6, verified: true, verificationReceiptSha256: H('e') });
  assert.equal(observation.ageDays, 14);
  assert.equal(observation.reverted, true);
  assert.equal(observation.humanRewriteRatio, 0.6);
  assert.equal(learner.snapshot().patchSurvival.observations, 1);
});
