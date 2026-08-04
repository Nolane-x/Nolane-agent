import assert from 'node:assert/strict';
import test from 'node:test';
import { ReviewQueueService } from '../src/experience/review-queue-service.mjs';
const hash = (c) => c.repeat(64);

test('review queue groups by risk and dependency rather than time only', () => {
  const queue = new ReviewQueueService();
  queue.add({ itemId: 'low-old', kind: 'file', target: 'readme.md', risk: 'low', createdAtMs: 1, receiptSha256: hash('a') });
  queue.add({ itemId: 'critical-new', kind: 'capability', target: 'network.send', risk: 'critical', createdAtMs: 9, dependencies: ['api-review'], receiptSha256: hash('b') });
  queue.add({ itemId: 'api-review', kind: 'file', target: 'auth.mjs', risk: 'high', createdAtMs: 10, receiptSha256: hash('c') });
  const snapshot = queue.snapshot();
  assert.equal(snapshot.items[0].itemId, 'api-review');
  assert.equal(snapshot.items[1].itemId, 'critical-new');
  assert.equal(snapshot.items.at(-1).itemId, 'low-old');
  assert.equal(queue.decide({ itemId: 'api-review', decision: 'approve', actor: 'reviewer', receiptSha256: hash('d') }).state, 'approved');
});
