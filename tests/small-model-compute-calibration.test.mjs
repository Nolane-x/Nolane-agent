import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveComputeGovernor } from '../src/small-model/adaptive-compute-governor.mjs';

test('AdaptiveComputeGovernor calibrates escalation on held-out labeled cases and applies the threshold', () => {
  const governor = new AdaptiveComputeGovernor();
  assert.throws(() => governor.calibrateEscalation({ heldOut: false, cases: [] }), /held-out/i);
  const calibration = governor.calibrateEscalation({ heldOut: true, cases: [
    { difficulty: 0.2, uncertainty: 0.2, risk: 0.2, shouldEscalate: false },
    { difficulty: 0.5, uncertainty: 0.5, risk: 0.5, shouldEscalate: false },
    { difficulty: 0.7, uncertainty: 0.7, risk: 0.7, shouldEscalate: true },
    { difficulty: 0.9, uncertainty: 0.8, risk: 0.7, shouldEscalate: true },
  ] });
  assert.equal(calibration.accuracy, 1);
  assert.ok(calibration.threshold > 0.5 && calibration.threshold <= 0.7);
  assert.equal(governor.allocate({ difficulty: 0.65, uncertainty: 0.65, risk: 0.65 }).escalationRequired, true);
  assert.match(calibration.receiptSha256, /^[a-f0-9]{64}$/);
});

test('AdaptiveComputeGovernor versions and rolls back escalation calibration', () => {
  const governor = new AdaptiveComputeGovernor();
  const casesA = [
    { difficulty: 0.2, uncertainty: 0.2, risk: 0.2, shouldEscalate: false },
    { difficulty: 0.8, uncertainty: 0.8, risk: 0.8, shouldEscalate: true },
  ];
  const v1 = governor.calibrateEscalation({ heldOut: true, cases: casesA });
  const v2 = governor.calibrateEscalation({ heldOut: true, cases: [
    { difficulty: 0.1, uncertainty: 0.1, risk: 0.1, shouldEscalate: false },
    { difficulty: 0.4, uncertainty: 0.4, risk: 0.4, shouldEscalate: true },
  ] });
  assert.notEqual(v1.receiptSha256, v2.receiptSha256);
  const rolled = governor.rollbackEscalationCalibration();
  assert.equal(rolled.threshold, v1.threshold);
  assert.equal(governor.snapshot().calibrations, 1);
});
