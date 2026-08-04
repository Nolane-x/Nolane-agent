import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyCheckpoint14ModelTruth } from '../scripts/verify-checkpoint-14-model-truth.mjs';

test('Checkpoint 14 model truth verifier proves convergence without claiming live provider certification', () => {
  const report = verifyCheckpoint14ModelTruth();
  assert.equal(report.pass, true, JSON.stringify(report.findings));
  assert.ok(report.implemented.includes('field-level-provenance-ledger'));
  assert.ok(report.implemented.includes('compatibility-model-profile-v2-projection'));
  assert.ok(report.externalOrLaterGates.includes('provider-live-discovery-certification'));
  assert.equal(report.schemas.includes('nolane.model-deployment.v1'), true);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
