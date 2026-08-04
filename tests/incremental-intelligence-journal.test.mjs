import assert from 'node:assert/strict';
import test from 'node:test';

import { IncrementalIntelligenceJournal } from '../src/repository/incremental-intelligence-journal.mjs';

test('IncrementalIntelligenceJournal coalesces duplicate content and exposes only newest path generation', () => {
  const journal = new IncrementalIntelligenceJournal();
  const first = journal.publish({ projectId: 'p1', path: 'src/a.mjs', contentHash: 'hash-a', generation: 'g1', kind: 'modify' });
  const duplicate = journal.publish({ projectId: 'p1', path: 'src/a.mjs', contentHash: 'hash-a', generation: 'g1', kind: 'modify' });
  const fresh = journal.publish({ projectId: 'p1', path: 'src/a.mjs', contentHash: 'hash-b', generation: 'g2', kind: 'modify' });
  assert.equal(first.cursor, duplicate.cursor);
  assert.equal(duplicate.coalesced, true);
  const batch = journal.readBatch({ consumerId: 'semantic', projectId: 'p1', limit: 10 });
  assert.equal(batch.items.length, 1);
  assert.equal(batch.items[0].cursor, fresh.cursor);
  assert.equal(batch.items[0].generation, 'g2');
  assert.equal(batch.items[0].supersedesCursor, first.cursor);
});

test('IncrementalIntelligenceJournal consumer cursors are monotonic and failed work is replayed until acked', () => {
  const journal = new IncrementalIntelligenceJournal();
  const a = journal.publish({ projectId: 'p1', path: 'a', contentHash: '1', generation: 'g1' });
  const b = journal.publish({ projectId: 'p1', path: 'b', contentHash: '2', generation: 'g1' });
  const first = journal.readBatch({ consumerId: 'graph', projectId: 'p1', limit: 1 });
  assert.equal(first.items[0].cursor, a.cursor);
  const replay = journal.readBatch({ consumerId: 'graph', projectId: 'p1', limit: 1 });
  assert.equal(replay.items[0].cursor, a.cursor);
  journal.ack({ consumerId: 'graph', cursor: a.cursor });
  assert.equal(journal.readBatch({ consumerId: 'graph', projectId: 'p1', limit: 1 }).items[0].cursor, b.cursor);
  assert.throws(() => journal.ack({ consumerId: 'graph', cursor: 0 }), /monotonic/);
});

test('IncrementalIntelligenceJournal bounds retained entries and reports the retention floor', () => {
  const journal = new IncrementalIntelligenceJournal({ maxEntries: 3 });
  for (let index = 1; index <= 5; index += 1) journal.publish({ projectId: 'p1', path: `f${index}`, contentHash: String(index), generation: `g${index}` });
  const snapshot = journal.snapshot();
  assert.equal(snapshot.entries.length, 3);
  assert.equal(snapshot.retentionFloorCursor, 2);
  assert.deepEqual(snapshot.entries.map((item) => item.cursor), [3, 4, 5]);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
});

test('IncrementalIntelligenceJournal rejects raw content and secret-like metadata', () => {
  const journal = new IncrementalIntelligenceJournal();
  const item = journal.publish({ projectId: 'p1', path: 'a', contentHash: 'hash', generation: 'g1', metadata: { language: 'js', content: 'private source', token: 'secret', source: 'watcher' } });
  assert.deepEqual(item.metadata, { language: 'js', source: 'watcher' });
  assert.equal(JSON.stringify(item).includes('private source'), false);
});
