import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultReleaseGates } from '../src/release/full-release-matrix.mjs';
import { measureDeepSuperiorityWaveBatch } from '../scripts/measure-deep-superiority-wave-batch.mjs';
import { verifyDeepSuperiorityWaveBatch } from '../src/release/deep-superiority-wave-batch-verifier.mjs';

test('beta.6 release matrix makes the deep superiority wave batch mandatory', () => {
  const gates = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.6' });
  assert.equal(gates.length, 161);
  assert.ok(gates.some((gate) => gate.id === 'deep-superiority-wave-batch'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-1'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-2'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-3'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-4'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-5'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-6'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-7'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-8'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-9'));
  assert.ok(gates.some((gate) => gate.id === 'forensic-recovery-checkpoint-10'));
  assert.ok(gates.some((gate) => gate.id === 'checkpoint-10-ux-foundation'));
});

test('deep superiority measurement proves all eight local waves while keeping external claims closed', async () => {
  const measurement = await measureDeepSuperiorityWaveBatch({ rootDirectory: process.cwd(), version: '5.0.0-beta.6' });
  assert.equal(measurement.constitution.forbiddenEffectBlocked, true);
  assert.equal(measurement.counterfactual.safeCandidateSelected, true);
  assert.equal(measurement.verificationMemory.humanPromotionRequired, true);
  assert.equal(measurement.selfHealing.boundedRepairExecuted, true);
  assert.equal(measurement.proofBudget.proofCapacityReserved, true);
  assert.equal(measurement.comparativeBenchmark.protocolClaimGateCanOpen, true);
  assert.equal(measurement.localUi.localCertificationPassed, true);
  assert.equal(measurement.dogfood.signedProviderRealProtocolAccepted, true);
  assert.equal(measurement.requirements.verified, 193);
  assert.equal(measurement.requirements.externalGate, 5);
  assert.equal(measurement.requirements.notImplemented, 0);
  assert.equal(measurement.claims.productionComparativeSuperiorityAllowed, false);
  assert.equal(measurement.claims.productionProviderRealDogfoodCertified, false);
});

test('deep superiority verifier validates production wiring, evidence and fail-closed boundaries', async () => {
  const report = await verifyDeepSuperiorityWaveBatch({ rootDirectory: process.cwd(), version: '5.0.0-beta.6' });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.failures, []);
  assert.equal(path.basename(report.measurementPath), 'deep-superiority-wave-batch-measurement-5.0.0-beta.6.json');
});
