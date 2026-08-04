import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyCheckpoint14Foundation } from '../scripts/verify-checkpoint-14-foundation.mjs';

test('Checkpoint 14 foundation verifier proves the implemented slice without claiming later gates', () => {
  const report = verifyCheckpoint14Foundation();
  assert.equal(report.pass, true, JSON.stringify(report.findings));
  assert.ok(report.implemented.includes('personalization-profile-settings-projection'));
  assert.ok(report.implemented.includes('four-screen-onboarding'));
  assert.ok(report.externalOrLaterGates.includes('windows-update-replay'));
  assert.ok(report.receiptSha256.length === 64);
});
