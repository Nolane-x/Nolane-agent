import test from 'node:test';
import assert from 'node:assert/strict';

import { VerifiedOutcomeBandit } from '../src/providers/verified-outcome-bandit.mjs';
import { OutcomeAwareProviderRouter } from '../src/providers/outcome-aware-router.mjs';
import { ProviderOutcomeFeedbackService } from '../src/providers/provider-outcome-feedback-service.mjs';

const hash = (char) => char.repeat(64);
const candidate = (providerId, harnessProfile, eligible = true) => ({ providerId, harnessProfile, eligible });

test('preserves hard constraints and ranks provider+harness pairs only in shadow mode', () => {
  const bandit = new VerifiedOutcomeBandit({ exploration: 0 });
  bandit.recordOutcome({
    providerId: 'blocked', harnessProfile: 'review', features: { taskType: 'debug', language: 'js', risk: 'high' },
    verified: true, verifiedCriteriaScore: 10, firstPatchPassed: true, retainedPatch: true, verificationReceiptSha256: hash('a'),
  });
  const result = bandit.rank({
    taskId: 'task-1', features: { taskType: 'debug', language: 'js', risk: 'high' },
    candidates: [candidate('blocked', 'review', false), candidate('eligible', 'impl', true)],
  });
  assert.equal(result.mode, 'shadow');
  assert.equal(result.selectedPairId, 'eligible::impl');
  assert.equal(result.ranked.find((item) => item.pairId === 'blocked::review').eligible, false);
  assert.equal(result.claims.productionTrafficChanged, false);
});

test('learns only from verified outcomes and rejects Accept-only reward', () => {
  const bandit = new VerifiedOutcomeBandit();
  assert.throws(() => bandit.recordOutcome({ providerId: 'p', harnessProfile: 'h', features: {}, accepted: true }), /verification receipt|verified outcome/i);
  assert.throws(() => bandit.recordOutcome({ providerId: 'p', harnessProfile: 'h', features: {}, accepted: true, verificationReceiptSha256: hash('b') }), /verified outcome/i);
  const recorded = bandit.recordOutcome({
    providerId: 'p', harnessProfile: 'h', features: { taskType: 'feature' }, verified: true,
    verifiedCriteriaScore: 4, firstPatchPassed: true, retainedPatch: true, tokenCost: 4000, rssMbSeconds: 2000,
    correctionCycles: 0, humanInterventions: 0, verificationReceiptSha256: hash('c'),
  });
  assert.equal(recorded.recorded, true);
  assert.ok(recorded.reward > 4);
});

test('penalizes latency, RSS, corrections and intervention for the same context', () => {
  const bandit = new VerifiedOutcomeBandit({ exploration: 0 });
  const features = { taskType: 'debug', language: 'ts', risk: 'medium' };
  for (let i = 0; i < 4; i += 1) {
    bandit.recordOutcome({ providerId: 'steady', harnessProfile: 'h1', features, verified: true, verifiedCriteriaScore: 5, firstPatchPassed: true, retainedPatch: true, tokenCost: 2000, latencyMs: 1000, peakRssMb: 300, rssMbSeconds: 3000, correctionCycles: 0, humanInterventions: 0, verificationReceiptSha256: hash(String(i + 1)) });
    bandit.recordOutcome({ providerId: 'heavy', harnessProfile: 'h2', features, verified: true, verifiedCriteriaScore: 5, firstPatchPassed: false, retainedPatch: true, tokenCost: 8000, latencyMs: 6000, peakRssMb: 1200, rssMbSeconds: 20000, correctionCycles: 2, humanInterventions: 1, verificationReceiptSha256: hash(String(i + 5)) });
  }
  const ranked = bandit.rank({ taskId: 'task-2', features, candidates: [candidate('heavy', 'h2'), candidate('steady', 'h1')] });
  assert.equal(ranked.selectedPairId, 'steady::h1');
  assert.ok(ranked.ranked[0].score > ranked.ranked[1].score);
});

test('uses deterministic cohorts and supports exact policy rollback', () => {
  const bandit = new VerifiedOutcomeBandit({ shadowRolloutPercent: 25 });
  const a = bandit.rank({ taskId: 'same-task', features: {}, candidates: [candidate('p', 'h')] });
  const b = bandit.rank({ taskId: 'same-task', features: {}, candidates: [candidate('p', 'h')] });
  assert.equal(a.cohortIncluded, b.cohortIncluded);
  const first = bandit.currentPolicy();
  const second = bandit.createPolicy({ version: 'policy-v2', reason: 'held-out candidate' });
  assert.equal(bandit.currentPolicy().version, 'policy-v2');
  const rollback = bandit.rollbackPolicy(first.version);
  assert.equal(rollback.current.version, first.version);
  assert.equal(rollback.current.policySha256, first.policySha256);
  assert.equal(second.parentVersion, first.version);
});

test('OutcomeAwareProviderRouter exposes bandit observations without changing static traffic authority', () => {
  const providers = [
    { id: 'a', profile: { capabilities: ['coding'], qualityTier: 3, costTier: 1, latencyTier: 1 }, publicView() { return this.profile; } },
    { id: 'b', profile: { capabilities: ['coding'], qualityTier: 4, costTier: 1, latencyTier: 1 }, publicView() { return this.profile; } },
  ];
  const registry = { list: () => providers, get: (id) => providers.find((p) => p.id === id), detection: () => null };
  const bandit = new VerifiedOutcomeBandit({ exploration: 0 });
  bandit.recordOutcome({ providerId: 'a', harnessProfile: 'ha', features: { taskType: 'debug' }, verified: true, verifiedCriteriaScore: 10, verificationReceiptSha256: hash('d') });
  const router = new OutcomeAwareProviderRouter({ registry, verifiedOutcomeBandit: bandit });
  const ranked = router.rank({ task: { id: 't', kind: 'debug', complexity: 0.5, harnessProfilesByProvider: { a: 'ha', b: 'hb' } }, requiredCapabilities: ['coding'] });
  assert.equal(ranked[0].provider.id, 'b', 'static router remains traffic authority');
  assert.ok(ranked.every((entry) => entry.shadowBandit));
  assert.equal(ranked.find((entry) => entry.provider.id === 'a').shadowBandit.mode, 'shadow');
});

test('ProviderOutcomeFeedbackService records a verified bandit outcome with task provenance', () => {
  const bandit = new VerifiedOutcomeBandit();
  const metrics = { record() {}, recordDecisionEfficiency() {} };
  const task = { id: 'task', role: 'builder', metadata: { handoff: { providerId: 'p' }, harnessProfile: 'h', taskKind: 'debug' } };
  const service = new ProviderOutcomeFeedbackService({ metrics, taskResolver: () => task, verifiedOutcomeBandit: bandit });
  const result = service.recordVerifiedBanditOutcome({ taskId: 'task', features: { language: 'js' }, verifiedCriteriaScore: 3, verified: true, verificationReceiptSha256: hash('e') });
  assert.equal(result.recorded, true);
  assert.equal(result.pairId, 'p::h');
});
