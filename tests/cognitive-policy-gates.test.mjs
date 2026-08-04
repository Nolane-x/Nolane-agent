import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryLease, evaluateCommitGate, evaluateStopGate } from '../src/cognition/cognitive-policy-gates.mjs';

test('bans a failed strategy only inside the current recovery lease', () => {
  let now = 1_000;
  const lease = new RecoveryLease({ leaseId: 'lease-1', ttlMs: 100, clock: () => now });
  lease.recordFailure('strategy-a', 'receipt-1');
  assert.equal(lease.canUse('strategy-a').allowed, false);
  now = 1_101;
  assert.equal(lease.canUse('strategy-a').allowed, true);
});

test('commit requires concentrated context dominant hypothesis bounded scope and known probe', () => {
  const denied = evaluateCommitGate({
    contextGate: { allowed: false }, dominantHypothesis: { id: 'h1', probability: 0.8, status: 'active' },
    scope: { files: 1, changedLines: 7 }, limits: { files: 2, changedLines: 80 }, verificationProbeId: 'test-1', blockedInvariantIds: [],
  });
  assert.equal(denied.allowed, false);
  assert.ok(denied.reasons.includes('context-posterior-dispersed'));
  const allowed = evaluateCommitGate({
    contextGate: { allowed: true }, dominantHypothesis: { id: 'h1', probability: 0.82, status: 'active' },
    scope: { files: 1, changedLines: 7 }, limits: { files: 2, changedLines: 80 }, verificationProbeId: 'test-1', blockedInvariantIds: [],
  });
  assert.equal(allowed.allowed, true);
});

test('stop is allowed after all criteria receipts or low remaining information gain', () => {
  assert.equal(evaluateStopGate({ allCriteriaVerified: true, marginalInformationGain: 0.8, unresolvedCriticalRisks: 0 }).stop, true);
  assert.equal(evaluateStopGate({ allCriteriaVerified: false, marginalInformationGain: 0.01, minInformationGain: 0.05, unresolvedCriticalRisks: 0 }).stop, true);
  assert.equal(evaluateStopGate({ allCriteriaVerified: false, marginalInformationGain: 0.01, minInformationGain: 0.05, unresolvedCriticalRisks: 1 }).stop, false);
});
