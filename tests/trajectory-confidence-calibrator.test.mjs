import test from 'node:test';
import assert from 'node:assert/strict';

import { TrajectoryConfidenceCalibrator } from '../src/verification/trajectory-confidence-calibrator.mjs';

const hash = (char) => char.repeat(64);

test('bounds completion confidence by the weakest critical trajectory stage', () => {
  const calibrator = new TrajectoryConfidenceCalibrator();
  const result = calibrator.assess({
    domain: 'backend', taskType: 'debug',
    stages: [
      { kind: 'requirement', confidence: 0.92, critical: true },
      { kind: 'retrieval', confidence: 0.84, critical: true },
      { kind: 'root-cause', confidence: 0.58, critical: true },
      { kind: 'verification', confidence: 0.96, critical: true },
    ],
  });
  assert.equal(result.weakestCritical.kind, 'root-cause');
  assert.ok(result.finalConfidence <= 0.58);
  assert.ok(result.finalConfidence < 0.58);
});

test('independent verification raises confidence only up to the weakest critical link', () => {
  const calibrator = new TrajectoryConfidenceCalibrator();
  const input = {
    domain: 'security', taskType: 'review',
    stages: [
      { kind: 'requirement', confidence: 0.8, critical: true },
      { kind: 'patch', confidence: 0.7, critical: true },
      { kind: 'verification', confidence: 0.75, critical: true },
    ],
  };
  const without = calibrator.assess(input);
  const withIndependent = calibrator.assess({ ...input, independentReceipts: [{ kind: 'independent-review', status: 'pass', receiptSha256: hash('a') }] });
  assert.ok(withIndependent.finalConfidence > without.finalConfidence);
  assert.ok(withIndependent.finalConfidence <= 0.7);
});

test('updates calibration only from verified outcomes', () => {
  const calibrator = new TrajectoryConfidenceCalibrator({ maxSamplesPerBucket: 10 });
  assert.throws(() => calibrator.recordOutcome({ domain: 'frontend', taskType: 'feature', confidence: 0.9, success: false }), /verification receipt/i);
  calibrator.recordOutcome({ domain: 'frontend', taskType: 'feature', confidence: 0.9, success: false, verificationReceiptSha256: hash('b') });
  calibrator.recordOutcome({ domain: 'frontend', taskType: 'feature', confidence: 0.2, success: true, verificationReceiptSha256: hash('c') });
  const bucket = calibrator.snapshot().buckets.find((item) => item.domain === 'frontend' && item.taskType === 'feature');
  assert.equal(bucket.samples, 2);
  assert.ok(bucket.brierError > 0.6);
  assert.equal(bucket.verifiedSamples, 2);
});
