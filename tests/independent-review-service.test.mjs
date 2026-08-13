import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { IndependentReviewService } from '../src/review/independent-review-service.mjs';

const DIFF = `diff --git a/src/auth.js b/src/auth.js
index 111..222 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -1,2 +1,3 @@
 export function login(user) {
+  return db.query('SELECT * FROM users WHERE name=' + user);
 }
`;

test('IndependentReviewService requires reviewer separation and supplies only diff plus bounded rules', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let request;
  const service = new IndependentReviewService({ file: path.join(root, 'review.sqlite'), reviewer: async (input) => { request = input; return { findings: [{ path: 'src/auth.js', line: 2, severity: 'high', category: 'security', message: 'SQL injection', evidence: 'string concatenation' }] }; } });
  await assert.rejects(() => service.review({ projectId: 'p', diff: DIFF, executorId: 'agent-1', reviewerId: 'agent-1' }), /different from executor/i);
  const result = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent-1', reviewerId: 'reviewer-1', rules: ['No SQL concatenation', 'x'.repeat(20_000)] });
  assert.equal(result.findings.length, 1);
  assert.match(request.diff, /SELECT/);
  assert.equal(Object.hasOwn(request, 'repository'), false);
  assert.ok(JSON.stringify(request.rules).length < 10_000);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  service.close();
});

test('IndependentReviewService deduplicates exact diff reviews and incrementally reviews only new changes', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-dedupe-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests = [];
  const service = new IndependentReviewService({ file: path.join(root, 'review.sqlite'), reviewer: async (input) => { requests.push(input); return { findings: input.diff.includes('eval(') ? [{ path: 'src/auth.js', line: 4, severity: 'critical', category: 'security', message: 'Avoid eval', evidence: 'eval call' }] : [] }; } });
  const first = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent', reviewerId: 'reviewer' });
  const duplicate = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent', reviewerId: 'reviewer' });
  assert.equal(duplicate.deduplicated, true);
  assert.equal(duplicate.reviewId, first.reviewId);
  assert.equal(requests.length, 1);

  const nextDiff = `${DIFF}\n@@ -4,0 +5,1 @@\n+eval(user.code);\n`;
  const second = await service.review({ projectId: 'p', diff: nextDiff, executorId: 'agent', reviewerId: 'reviewer', priorReviewId: first.reviewId });
  assert.equal(requests.length, 2);
  assert.match(requests[1].diff, /eval/);
  assert.equal(requests[1].diff.includes('SELECT'), false, 'already-reviewed added line is not sent again');
  assert.equal(second.findings[0].message, 'Avoid eval');
  service.close();
});

test('IndependentReviewService incrementally reviews deletion-only diffs', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-deletion-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests = [];
  const service = new IndependentReviewService({ file: path.join(root, 'review.sqlite'), reviewer: async (input) => { requests.push(input); return { findings: [] }; } });
  const first = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent', reviewerId: 'reviewer' });
  const deletionOnly = `diff --git a/src/auth.js b/src/auth.js
index 222..333 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -1,3 +1,2 @@
 export function login(user) {
-  return db.query('SELECT * FROM users WHERE name=' + user);
 }
`;
  await service.review({ projectId: 'p', diff: deletionOnly, executorId: 'agent', reviewerId: 'reviewer', priorReviewId: first.reviewId });
  assert.equal(requests.length, 2);
  assert.match(requests[1].diff, /@@ -1,3 \+1,2 @@/);
  assert.match(requests[1].diff, /^-  return db\.query/m);
  assert.equal(requests[1].diff.includes('+  return db.query'), false);
  service.close();
});

test('IndependentReviewService merges deterministic scanners and creates a repair handoff', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-handoff-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new IndependentReviewService({
    file: path.join(root, 'review.sqlite'),
    reviewer: async () => ({ findings: [] }),
    scanners: [{ id: 'secret-scan', scan: async () => [{ path: '.env', line: 1, severity: 'critical', category: 'secret', message: 'Credential in diff', evidence: 'API_KEY' }] }],
  });
  const review = await service.review({ projectId: 'p', diff: '+API_KEY=secret', executorId: 'builder', reviewerId: 'security-reviewer', baseSha: 'a', headSha: 'b' });
  assert.equal(review.findings[0].source, 'scanner:secret-scan');
  const handoff = service.createRepairHandoff(review.reviewId, { targetAgentProfile: 'security-fixer' });
  assert.equal(handoff.schema, 'forge.review-repair-handoff.v1');
  assert.equal(handoff.findings.length, 1);
  assert.equal(handoff.targetAgentProfile, 'security-fixer');
  assert.match(handoff.handoffSha256, /^[a-f0-9]{64}$/);
  service.close();
});
