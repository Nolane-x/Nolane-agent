import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReviewController, renderReviewView } from '../ui-v3/views/review/review-view.mjs';
import { renderMissionView } from '../ui-v3/views/mission/mission-view.mjs';

const REVIEW = Object.freeze({
  schema: 'forge.diff-review.snapshot.v1',
  missionId: 'm1',
  projectId: 'p1',
  reviewSha256: 'a'.repeat(64),
  files: Object.freeze([
    Object.freeze({
      taskId: 't1',
      path: 'src/auth.mjs',
      kind: 'modified',
      sourceSnapshotSha256: 'b'.repeat(64),
      hunks: Object.freeze([
        Object.freeze({ id: 'c'.repeat(64), header: '@@ -1 +1 @@', lines: Object.freeze(['-old()', '+<img src=x onerror=alert(1)>']), decision: 'pending' }),
      ]),
    }),
  ]),
});

test('review detail controller loads the real diff-review snapshot and binds decisions to its exact review SHA', async () => {
  const posts = [];
  const api = {
    async get(path) { assert.equal(path, '/api/agent/runs/m1/diff-review'); return REVIEW; },
    async post(path, body) { posts.push([path, body]); return { decision: body.decision, receiptSha256: 'd'.repeat(64) }; },
  };
  const controller = createReviewController({ api, missionId: 'm1', language: 'en' });
  await controller.load();
  assert.equal(controller.snapshot().review.reviewSha256, REVIEW.reviewSha256);
  const result = await controller.decide({ taskId: 't1', hunkId: 'c'.repeat(64), decision: 'accept', reason: 'Matches the mission intent.' });
  assert.equal(result.ok, true);
  assert.equal(posts[0][0], '/api/agent/runs/m1/diff-review/decisions');
  assert.equal(posts[0][1].expectedReviewSha256, REVIEW.reviewSha256);
  assert.equal(posts[0][1].reason, 'Matches the mission intent.');
});

test('review detail controller fails closed on stale snapshots and refreshes current truth', async () => {
  let gets = 0;
  const api = {
    async get() { gets += 1; return { ...REVIEW, reviewSha256: (gets === 1 ? 'a' : 'e').repeat(64) }; },
    async post() { throw Object.assign(new Error('Diff review snapshot changed; refresh before deciding'), { status: 409 }); },
  };
  const controller = createReviewController({ api, missionId: 'm1', language: 'en' });
  await controller.load();
  const result = await controller.decide({ taskId: 't1', hunkId: 'c'.repeat(64), decision: 'reject', reason: 'Keep old behavior.' });
  assert.equal(result.stale, true);
  assert.equal(gets, 2);
  assert.equal(controller.snapshot().review.reviewSha256, 'e'.repeat(64));
  assert.match(controller.snapshot().notice, /changed/i);
});

test('server-backed Review renders real hunks, escapes diff content, and requires explicit reason controls', () => {
  const html = renderReviewView({ status: 'ready', missionId: 'm1', review: REVIEW, notice: null, error: null, busyHunkId: null }, { language: 'en' });
  assert.match(html, /src\/auth\.mjs/);
  assert.match(html, /data-review-decision="accept"/);
  assert.match(html, /data-review-decision="reject"/);
  assert.match(html, /data-review-reason/);
  assert.match(html, /aaaaaaaaaaaa/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('Mission component escapes externally supplied titles, statuses, and activity summaries', () => {
  const html = renderMissionView({
    header: { title: '<img src=x onerror=alert(1)>', status: '<script>x</script>', phase: '<b>phase</b>' },
    tasks: [{ id: 't1', title: '<svg onload=alert(1)>', status: '<i>running</i>' }],
    activity: [{ summary: '<video onerror=alert(1)>' }],
  });
  assert.doesNotMatch(html, /<img src=x|<script>|<svg onload|<video onerror|<b>phase|<i>running/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&lt;video onerror/);
});

test('Activity polling and controls reuse shared focus-preserving rerender authority', async () => {
  const [app, activity] = await Promise.all([
    readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ui-v3/views/activity/activity-view.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(activity, /data-preserve-key="activity-follow"/);
  assert.match(activity, /data-preserve-key="activity-filter-\$\{id\}"/);
  assert.match(app, /const repaint=\(preserve=null\)=>rerenderView\(root,view,\{preserve\}\)/);
  assert.match(app, /root\?\.contains\(document\.activeElement\)\?document\.activeElement:null/);
  assert.match(app, /next\.focus\(\{ preventScroll: true \}\)/);
});

test('Review route uses the server-backed controller and decision contract', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /createReviewController/);
  assert.match(app, /await controller\.load\(\)/);
  assert.match(app, /data-review-decision/);
  assert.match(app, /controller\.decide/);
});
