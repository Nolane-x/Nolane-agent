import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewModel } from '../ui-v3/views/review/review-view.mjs';
import { createChangeNavigatorModel } from '../ui-v3/views/review/change-navigator.mjs';
import { createDiffViewportModel } from '../ui-v3/views/review/diff-viewport.mjs';
import { buildVerificationSummary } from '../ui-v3/views/review/verification-summary.mjs';
import { chunkDiffHunks, createDiffWorkerJob } from '../ui-v3/workers/diff-worker.mjs';

test('review decisions bind to hunk content hash and evidence and reject stale updates', () => {
  const model = createReviewModel({ missionId: 'm1' });
  model.updateFiles([{ id: 'f1', path: 'src/a.mjs' }]);
  model.updateHunks([{ id: 'h1', fileId: 'f1', content: '-old\n+new', evidenceIds: ['e1'] }]);
  const initial = model.snapshot().hunks[0];
  const receipt = model.decideHunk('h1', 'accepted', { expectedContentSha256: initial.contentSha256, evidenceIds: ['e1'], actor: 'user' });
  assert.equal(receipt.decision, 'accepted');
  assert.equal(receipt.contentSha256, initial.contentSha256);
  model.updateHunks([{ id: 'h1', fileId: 'f1', content: '-old\n+newer', evidenceIds: ['e2'] }]);
  assert.throws(() => model.decideHunk('h1', 'accepted', { expectedContentSha256: initial.contentSha256, evidenceIds: ['e1'] }), /stale/i);
});

test('change navigator groups files and filters risky unresolved changes', () => {
  const nav = createChangeNavigatorModel();
  nav.update([
    { id: 'a', path: 'src/a.mjs', change: 'modified', risk: 'low', decision: 'accepted' },
    { id: 'b', path: 'src/b.mjs', change: 'added', risk: 'high', decision: 'pending' },
    { id: 'c', path: 'src/c.mjs', change: 'deleted', risk: 'medium', decision: 'pending' },
  ]);
  nav.setFilter('needs-attention');
  const snapshot = nav.snapshot();
  assert.deepEqual(snapshot.files.map((item) => item.id), ['b', 'c']);
  assert.deepEqual(snapshot.groups.map((item) => item.change), ['added', 'deleted']);
});

test('diff viewport windows large hunk sets and stops work after destroy', () => {
  const viewport = createDiffViewportModel({ overscan: 2 });
  viewport.update(Array.from({ length: 1000 }, (_, index) => ({ id: `h${index}`, lines: 3 })));
  viewport.setWindow({ offset: 990, limit: 5 });
  const value = viewport.snapshot();
  assert.equal(value.total, 1000);
  assert.equal(value.visible.length, 7);
  assert.equal(value.visible[0].id, 'h988');
  viewport.destroy();
  assert.throws(() => viewport.update([]), /destroyed/i);
});

test('diff worker chunks deterministically and supports cancellation', async () => {
  const hunks = Array.from({ length: 25 }, (_, index) => ({ id: `h${index}`, content: `line-${index}` }));
  assert.deepEqual(chunkDiffHunks(hunks, { chunkSize: 10 }).map((chunk) => chunk.length), [10, 10, 5]);
  const job = createDiffWorkerJob({ hunks, chunkSize: 5 });
  const iterator = job.run();
  const first = await iterator.next();
  assert.equal(first.value.hunks.length, 5);
  job.cancel();
  const second = await iterator.next();
  assert.equal(second.done, true);
  assert.equal(job.snapshot().cancelled, true);
});

test('verification summary derives readiness only from bound evidence', () => {
  const summary = buildVerificationSummary({
    tests: [{ id: 'test-1', status: 'pass', receiptSha256: 'a'.repeat(64) }],
    security: [{ id: 'sec-1', status: 'pass', receiptSha256: 'b'.repeat(64) }],
    scope: { intendedFiles: ['src/a.mjs'], changedFiles: ['src/a.mjs'] },
    evidence: [{ id: 'e1', sha256: 'c'.repeat(64), verifierIndependent: true }],
  });
  assert.equal(summary.readyToShip, true);
  assert.equal(summary.risk, 'low');
  const incomplete = buildVerificationSummary({ tests: [{ id: 'test-1', status: 'pass' }], scope: { intendedFiles: [], changedFiles: ['x'] }, evidence: [] });
  assert.equal(incomplete.readyToShip, false);
  assert.equal(incomplete.risk, 'high');
});
