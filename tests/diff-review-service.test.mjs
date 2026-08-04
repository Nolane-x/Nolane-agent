import assert from 'node:assert/strict';
import test from 'node:test';

import { DiffReviewService, parseGitDiff } from '../src/review/diff-review-service.mjs';

const DIFF = `diff --git a/src/auth.mjs b/src/auth.mjs
index 1111111..2222222 100644
--- a/src/auth.mjs
+++ b/src/auth.mjs
@@ -1,3 +1,3 @@
 export function login() {
-  return false;
+  return true;
 }
@@ -8,2 +8,3 @@
 export const mode = 'safe';
+export const audited = true;
 export const end = true;
`;

function fixture() {
  const mission = { id: 'm1', projectId: 'p1', metadata: {} };
  const task = { id: 't1', missionId: 'm1', projectId: 'p1', role: 'builder', metadata: { worktree: { path: '/tmp/wt' } } };
  const mutations = [];
  const events = [];
  const store = {
    getMission(id) { return id === mission.id ? mission : null; },
    listTasks({ missionId }) { return missionId === mission.id ? [task] : []; },
    updateMission(id, changes) { Object.assign(mission, changes); return mission; },
    appendEvent(event) { events.push(event); return event; },
  };
  const gitInspector = { async snapshot() { return { schema: 'forge.git.snapshot.v1', taskId: task.id, diff: DIFF, snapshotSha256: 'a'.repeat(64), truncated: false }; } };
  const mutator = async (input) => { mutations.push(input); return { status: 'pass', receiptSha256: 'b'.repeat(64) }; };
  return { mission, task, store, gitInspector, mutator, mutations, events };
}

test('parseGitDiff creates stable file and hunk identities with bounded source lines', () => {
  const files = parseGitDiff(DIFF);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'src/auth.mjs');
  assert.equal(files[0].hunks.length, 2);
  assert.match(files[0].hunks[0].id, /^[a-f0-9]{64}$/);
  assert.equal(files[0].hunks[0].oldStart, 1);
  assert.deepEqual(files[0].hunks[0].lines.slice(1, 3), ['-  return false;', '+  return true;']);
});

test('DiffReviewService snapshots candidate hunks and persists actor-bound accept decisions', async () => {
  const f = fixture();
  const service = new DiffReviewService({ store: f.store, gitInspector: f.gitInspector, mutator: f.mutator });
  const snapshot = await service.snapshot('m1');
  assert.equal(snapshot.files[0].hunks.length, 2);
  assert.match(snapshot.reviewSha256, /^[a-f0-9]{64}$/);
  const hunkId = snapshot.files[0].hunks[0].id;
  const result = await service.decide({ missionId: 'm1', taskId: 't1', hunkId, decision: 'accept', expectedReviewSha256: snapshot.reviewSha256, principal: { subject: 'alice' }, reason: 'Login fix is correct' });
  assert.equal(result.decision, 'accept');
  assert.equal(result.actor, 'alice');
  assert.equal(f.mutations.length, 0);
  assert.equal((await service.snapshot('m1')).files[0].hunks[0].decision, 'accept');
  assert.equal(f.events.at(-1).type, 'diff-review.decision-recorded');
});

test('rejecting one hunk applies an exact reverse patch and fails closed on stale snapshots', async () => {
  const f = fixture();
  const service = new DiffReviewService({ store: f.store, gitInspector: f.gitInspector, mutator: f.mutator });
  const snapshot = await service.snapshot('m1');
  const hunk = snapshot.files[0].hunks[0];
  await assert.rejects(() => service.decide({ missionId: 'm1', taskId: 't1', hunkId: hunk.id, decision: 'reject', expectedReviewSha256: '0'.repeat(64), principal: { subject: 'alice' }, reason: 'No' }), (error) => error.code === 'DIFF_REVIEW_STALE');
  const result = await service.decide({ missionId: 'm1', taskId: 't1', hunkId: hunk.id, decision: 'reject', expectedReviewSha256: snapshot.reviewSha256, principal: { subject: 'alice' }, reason: 'Keep old behavior' });
  assert.equal(result.decision, 'reject');
  assert.equal(f.mutations.length, 1);
  assert.equal(f.mutations[0].task.id, 't1');
  assert.match(f.mutations[0].patch, /@@ -1,3 \+1,3 @@/);
  assert.match(f.mutations[0].patch, /-  return true;/);
  assert.match(f.mutations[0].patch, /\+  return false;/);
  assert.equal(f.mutations[0].expectedSnapshotSha256, 'a'.repeat(64));
});

test('DiffReviewService rejects anonymous, invalid, truncated, and unknown-hunk decisions', async () => {
  const f = fixture();
  const service = new DiffReviewService({ store: f.store, gitInspector: f.gitInspector, mutator: f.mutator });
  const snapshot = await service.snapshot('m1');
  await assert.rejects(() => service.decide({ missionId: 'm1', taskId: 't1', hunkId: snapshot.files[0].hunks[0].id, decision: 'accept', expectedReviewSha256: snapshot.reviewSha256, principal: {}, reason: 'ok' }), /authenticated principal/i);
  await assert.rejects(() => service.decide({ missionId: 'm1', taskId: 't1', hunkId: 'f'.repeat(64), decision: 'accept', expectedReviewSha256: snapshot.reviewSha256, principal: { subject: 'alice' }, reason: 'ok' }), /unknown diff hunk/i);
  f.gitInspector.snapshot = async () => ({ diff: DIFF, snapshotSha256: 'c'.repeat(64), truncated: true });
  await assert.rejects(() => service.snapshot('m1'), (error) => error.code === 'DIFF_REVIEW_TRUNCATED');
});
