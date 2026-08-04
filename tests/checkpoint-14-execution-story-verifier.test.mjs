import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyCheckpoint14ExecutionStory } from '../scripts/verify-checkpoint-14-execution-story.mjs';

test('Checkpoint 14 Execution Story verifier proves normalized progressive visibility', () => {
  const report = verifyCheckpoint14ExecutionStory();
  assert.equal(report.pass, true, JSON.stringify(report.findings));
  assert.ok(report.implemented.includes('single-durable-event-ledger-projection'));
  assert.ok(report.implemented.includes('level-specific-detail-projection'));
  assert.ok(!report.externalOrLaterGates.includes('time-travel'));
  assert.ok(report.externalOrLaterGates.includes('long-duration-story-ledger-dogfood'));
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
