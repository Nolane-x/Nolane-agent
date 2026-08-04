import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewModel, buildReviewSummary } from '../ui-v3/views/review/review-view.mjs';
import { createRollbackPlan, selectShipAction } from '../ui-v3/views/review/ship-actions.mjs';

test('review model virtualizes large hunk sets and preserves hunk decisions', () => {
  const model = createReviewModel({ missionId: 'm1' });
  model.updateFiles([{ id: 'f1', path: 'src/a.mjs', change: 'modified', risk: 'high' }]);
  model.updateHunks(Array.from({ length: 10000 }, (_, index) => ({ id: `h${index}`, fileId: 'f1', start: index * 3, lines: 3 })));
  model.decideHunk('h9999', 'accepted');
  model.commentHunk('h9999', { author: 'user', text: 'Keep this guard.' });
  const snapshot = model.snapshot({ hunkOffset: 9980, hunkLimit: 20 });
  assert.equal(snapshot.totalHunks, 10000);
  assert.equal(snapshot.hunks.length, 20);
  assert.equal(snapshot.hunks.at(-1).decision, 'accepted');
  assert.equal(snapshot.hunks.at(-1).comments.length, 1);
});

test('review summary reports verification gaps and out-of-scope risk', () => {
  const summary = buildReviewSummary({
    files: [{ id: 'f1', path: 'src/a.mjs', intended: true }, { id: 'f2', path: 'secret.txt', intended: false }],
    tests: { passed: 23, total: 24 }, evidenceComplete: false, migrations: [{ id: 'db1' }],
  });
  assert.equal(summary.outOfScopeFiles, 1);
  assert.equal(summary.testsComplete, false);
  assert.equal(summary.readyToShip, false);
  assert.equal(summary.risk, 'high');
});

test('ship action and rollback are fail-closed', () => {
  assert.equal(selectShipAction({ projectState: 'local-dirty', canCommit: true }), 'commit');
  assert.equal(selectShipAction({ projectState: 'clean', canPush: true }), 'push');
  assert.equal(selectShipAction({ projectState: 'unknown' }), 'export-patch');
  const plan = createRollbackPlan({ checkpointId: 'cp1', checkpointSha256: 'c'.repeat(64), files: ['a', 'b'], discardCount: 3 });
  assert.equal(plan.preserveConversation, true);
  assert.equal(plan.preserveTerminalHistory, true);
  assert.throws(() => createRollbackPlan({ checkpointId: 'cp1', files: [] }), /checkpointSha256/i);
});
