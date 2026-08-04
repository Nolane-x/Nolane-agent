import test from 'node:test';
import assert from 'node:assert/strict';

import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const hash = (char) => char.repeat(64);

function passingEvidence() {
  return {
    criteria: [{ criterionId: 'c1', complete: true, receiptSha256: hash('a') }],
    stageReceipts: [
      { kind: 'parse-type', status: 'pass', receiptSha256: hash('b') },
      { kind: 'targeted', status: 'pass', receiptSha256: hash('c') },
    ],
    testIntegrity: { allowedAsCompletionEvidence: true, blockingFindings: 0, receiptSha256: hash('d') },
    apiDecisions: [{ allowed: true, status: 'pass', receiptSha256: hash('e') }],
    reviewDecision: { status: 'pass', unresolvedFindingFingerprints: [], receiptSha256: hash('f') },
    failureProofs: [],
    trajectory: { finalConfidence: 0.78, weakestCritical: { kind: 'root-cause', confidence: 0.8 }, receiptSha256: hash('1') },
    residualRisks: [],
    rollbackPoint: 'commit-abc',
  };
}

test('DecisionPlane loads Verification Control Plane lazily', () => {
  const plane = new DecisionPlane();
  assert.equal(plane.snapshot().lifecycle.verificationLoaded, false);
  const plan = plane.planVerification({ risk: 'low', changedSymbols: ['a'], impactedTests: ['a-test'], criterionIds: ['c1'] });
  assert.deepEqual(plan.stages.map((item) => item.kind), ['parse-type', 'targeted']);
  assert.equal(plane.snapshot().lifecycle.verificationLoaded, true);
  plane.close();
});

test('semantic completion blocks false-green test, API and reviewer evidence', () => {
  const plane = new DecisionPlane();
  const input = passingEvidence();
  const blocked = plane.decideSemanticCompletion({
    ...input,
    testIntegrity: { allowedAsCompletionEvidence: false, blockingFindings: 1, receiptSha256: hash('d') },
    apiDecisions: [{ allowed: false, status: 'fail', receiptSha256: hash('e') }],
    reviewDecision: { status: 'blocked', unresolvedFindingFingerprints: [hash('9')], receiptSha256: hash('f') },
  });
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.reasons.includes('test-integrity-blocked'));
  assert.ok(blocked.reasons.includes('api-existence-blocked'));
  assert.ok(blocked.reasons.includes('independent-review-unresolved'));
  assert.equal(blocked.claims.greenSuiteAloneSufficient, false);
  plane.close();
});

test('semantic completion passes only when required stages, criteria, confidence and rollback evidence pass', () => {
  const plane = new DecisionPlane();
  const plan = plane.planVerification({ risk: 'low', changedSymbols: ['a'], impactedTests: ['a-test'], criterionIds: ['c1'] });
  const decision = plane.decideSemanticCompletion({ ...passingEvidence(), pyramidPlan: plan });
  assert.equal(decision.status, 'pass');
  assert.equal(decision.completionAllowed, true);
  assert.equal(decision.reasons.length, 0);
  assert.match(decision.receiptSha256, /^[a-f0-9]{64}$/);
  plane.close();
});

test('Verification Control Plane exposes privacy-safe component operations', async () => {
  let reviewRequest;
  const plane = new DecisionPlane({ verification: {
    reviewService: { async review(input) { reviewRequest = input; return { reviewId: 'r', receiptSha256: hash('2'), findings: [] }; } },
    bandit: { exploration: 0 },
  } });
  const integrity = plane.assessTestIntegrity({ diff: 'diff --git a/src/a.mjs b/src/a.mjs\n+x();\n', sourceHash: hash('3'), testRuns: [{ testId: 'a', status: 'pass', flaky: false, receiptSha256: hash('4') }] });
  assert.equal(integrity.allowedAsCompletionEvidence, true);
  const api = plane.verifyApiExistence({ request: { kind: 'symbol', name: 'x', package: 'p' }, evidence: [{ kind: 'lsp-symbol', name: 'x', package: 'p', receiptSha256: hash('5') }] });
  assert.equal(api.allowed, true);
  const review = await plane.runAdversarialReview({ projectId: 'p', executor: { id: 'e', providerId: 'a', model: 'm1', harnessProfile: 'impl' }, reviewerCandidates: [{ id: 'r', providerId: 'b', model: 'm2', harnessProfile: 'review', role: 'reviewer' }], diff: '+x();', requirements: [], evidence: [], testReceipts: [], residualRisks: [], executorRationale: 'private rationale' });
  assert.equal(review.status, 'pass');
  assert.equal(JSON.stringify(reviewRequest).includes('private rationale'), false);
  const confidence = plane.calibrateTrajectory({ domain: 'backend', taskType: 'debug', stages: [{ kind: 'root-cause', confidence: 0.7, critical: true }, { kind: 'verification', confidence: 0.9, critical: true }] });
  assert.ok(confidence.finalConfidence <= 0.7);
  const snapshot = plane.snapshot();
  assert.equal(snapshot.verification.claims.privateReasoningStored, false);
  assert.equal(JSON.stringify(snapshot).includes('private rationale'), false);
  plane.close();
});
