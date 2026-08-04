import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { measureCognitiveDecisionKernel } from '../scripts/measure-cognitive-decision-kernel.mjs';

test('current cognitive measurement supplies independent effect receipts for denied and allowed commits', async () => {
  const report = await measureCognitiveDecisionKernel({ rootDirectory: path.resolve('.'), version: '3.2.0' });

  assert.equal(report.commit.deniedBeforeEvidence, true);
  assert.deepEqual(report.commit.deniedReasons, ['tool-effect-false-success']);
  assert.equal(report.commit.allowedAfterEvidence, true);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
