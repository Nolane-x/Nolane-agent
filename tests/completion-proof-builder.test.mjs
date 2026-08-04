import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletionProof } from '../src/construction/completion-proof-builder.mjs';

const completeInput = {
  missionId: 'm1', specificationId: 'spec1',
  criteria: [{ criterionId: 'c1', complete: true, receiptSha256: 'c1-receipt' }],
  traceabilityReceiptSha256: 'trace-receipt',
  invariantVerification: { allowed: true, receiptSha256: 'invariant-receipt', blockingInvariantIds: [] },
  changedSymbols: ['validateSession'], semanticFootprint: 4,
  decisionReceiptIds: ['d1'], verificationReceiptIds: ['v1'],
  residualRisks: ['browser-not-run'], limitations: ['fixture-only-candidate-generation'], rollbackPoint: 'commit-abc',
};

test('refuses completion when required evidence is missing', () => {
  const result = buildCompletionProof({ ...completeInput, rollbackPoint: '', verificationReceiptIds: [] });
  assert.equal(result.status, 'incomplete');
  assert.ok(result.missingEvidence.includes('rollback-point'));
  assert.ok(result.missingEvidence.includes('verification-receipts'));
});

test('builds immutable privacy-safe proof when every required receipt exists', () => {
  const result = buildCompletionProof(completeInput);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.changedSymbols, ['validateSession']);
  assert.ok(result.receiptSha256);
  assert.ok(Object.isFrozen(result));
  assert.equal(JSON.stringify(result).includes('chainOfThought'), false);
});

test('requires semantic completion evidence when the proof contract requests it', () => {
  const incomplete = buildCompletionProof({ ...completeInput, requireSemanticCompletion: true });
  assert.equal(incomplete.status, 'incomplete');
  assert.ok(incomplete.missingEvidence.includes('semantic-completion'));

  const complete = buildCompletionProof({
    ...completeInput,
    requireSemanticCompletion: true,
    semanticCompletionDecision: { status: 'pass', completionAllowed: true, receiptSha256: 'semantic-receipt' },
    trajectoryConfidence: { finalConfidence: 0.72, receiptSha256: 'confidence-receipt' },
    testIntegrityReceiptSha256: 'test-integrity-receipt',
    apiDecisionReceiptIds: ['api-receipt'],
    independentReviewReceiptSha256: 'review-receipt',
    failureProofReceiptIds: ['failure-receipt'],
  });
  assert.equal(complete.status, 'complete');
  assert.equal(complete.semanticCompletionDecision.status, 'pass');
  assert.equal(complete.trajectoryConfidence.finalConfidence, 0.72);
});
