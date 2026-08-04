import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyCheckpoint14TimeTravel } from '../scripts/verify-checkpoint-14-time-travel.mjs';

test('Checkpoint 14 Time Travel verifier proves the implementation contract', () => {
  const report = verifyCheckpoint14TimeTravel();
  assert.equal(report.pass, true, JSON.stringify(report.findings, null, 2));
  assert.equal(report.missingFiles.length, 0);
  assert.ok(report.schemas.includes('nolane.time-travel-checkpoint.v1'));
  assert.ok(report.implemented.includes('explicit-overwrite-confirmation'));
  assert.ok(report.externalOrLaterGates.includes('real-windows-worktree-and-restore-certification'));
});
