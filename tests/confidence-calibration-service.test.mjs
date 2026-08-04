import assert from 'node:assert/strict';
import test from 'node:test';

import { ConfidenceCalibrationService } from '../src/cognition/confidence-calibration-service.mjs';

const sha = (char) => char.repeat(64);

test('keeps verified Beta calibration separate by lane domain and task kind', () => {
  const service = new ConfidenceCalibrationService();
  service.recordOutcome({ outcomeId: 'o1', lane: 'retrieval', domain: 'backend', taskKind: 'debug', predictedConfidence: 0.9, success: false, verified: true, verificationReceiptSha256: sha('a') });
  service.recordOutcome({ outcomeId: 'o2', lane: 'retrieval', domain: 'backend', taskKind: 'debug', predictedConfidence: 0.8, success: false, verified: true, verificationReceiptSha256: sha('b') });
  service.recordOutcome({ outcomeId: 'o3', lane: 'verification', domain: 'backend', taskKind: 'debug', predictedConfidence: 0.8, success: true, verified: true, verificationReceiptSha256: sha('c') });
  const retrieval = service.calibrate({ lane: 'retrieval', domain: 'backend', taskKind: 'debug', rawConfidence: 0.9 });
  const verification = service.calibrate({ lane: 'verification', domain: 'backend', taskKind: 'debug', rawConfidence: 0.9 });
  const otherDomain = service.calibrate({ lane: 'retrieval', domain: 'frontend', taskKind: 'debug', rawConfidence: 0.9 });
  assert.ok(retrieval.calibratedConfidence < verification.calibratedConfidence);
  assert.equal(otherDomain.sampleCount, 0);
  assert.equal(service.snapshot().buckets.length, 2);
});

test('rejects unverified outcomes and keeps duplicate verified outcomes idempotent', () => {
  const service = new ConfidenceCalibrationService();
  assert.throws(() => service.recordOutcome({ outcomeId: 'o1', lane: 'plan', domain: 'backend', taskKind: 'feature', predictedConfidence: 0.7, success: true, verified: false, verificationReceiptSha256: sha('a') }), /verified outcome/i);
  service.recordOutcome({ outcomeId: 'o1', lane: 'plan', domain: 'backend', taskKind: 'feature', predictedConfidence: 0.7, success: true, verified: true, verificationReceiptSha256: sha('a') });
  const duplicate = service.recordOutcome({ outcomeId: 'o1', lane: 'plan', domain: 'backend', taskKind: 'feature', predictedConfidence: 0.7, success: true, verified: true, verificationReceiptSha256: sha('a') });
  assert.equal(duplicate.duplicate, true);
  assert.equal(service.snapshot().buckets[0].sampleCount, 1);
});

test('final confidence starts at the weakest lane and adds only a capped independent evidence bonus', () => {
  const service = new ConfidenceCalibrationService({ maxIndependentEvidenceBonus: 0.15 });
  const base = service.finalConfidence({
    domain: 'backend', taskKind: 'debug',
    lanes: { requirement: 0.9, retrieval: 0.6, hypothesis: 0.8, plan: 0.85, execution: 0.9, patch: 0.88, verification: 0.92 },
  });
  const withEvidence = service.finalConfidence({
    domain: 'backend', taskKind: 'debug',
    lanes: { requirement: 0.9, retrieval: 0.6, hypothesis: 0.8, plan: 0.85, execution: 0.9, patch: 0.88, verification: 0.92 },
    independentEvidence: [
      { family: 'targeted-test', confidence: 1, receiptSha256: sha('a') },
      { family: 'review', confidence: 1, receiptSha256: sha('b') },
      { family: 'runtime-probe', confidence: 1, receiptSha256: sha('c') },
      { family: 'mutation', confidence: 1, receiptSha256: sha('d') },
    ],
  });
  assert.equal(base.weakestLane.lane, 'retrieval');
  assert.equal(base.finalConfidence, base.weakestLane.calibratedConfidence);
  assert.ok(withEvidence.finalConfidence > base.finalConfidence);
  assert.ok(withEvidence.evidenceBonus <= 0.15);
});

test('duplicate or correlated evidence families cannot multiply confidence bonus', () => {
  const service = new ConfidenceCalibrationService();
  const common = { domain: 'security', taskKind: 'review', lanes: { requirement: 0.7, retrieval: 0.7, hypothesis: 0.7, plan: 0.7, execution: 0.7, patch: 0.7, verification: 0.7 } };
  const one = service.finalConfidence({ ...common, independentEvidence: [{ family: 'test', confidence: 1, receiptSha256: sha('a') }] });
  const duplicates = service.finalConfidence({ ...common, independentEvidence: [
    { family: 'test', confidence: 1, receiptSha256: sha('a') },
    { family: 'test', confidence: 1, receiptSha256: sha('b') },
    { family: 'test', confidence: 1, receiptSha256: sha('a') },
  ] });
  assert.equal(duplicates.evidenceBonus, one.evidenceBonus);
  assert.equal(duplicates.independentEvidenceFamilies.length, 1);
});
