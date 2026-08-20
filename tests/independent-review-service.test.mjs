import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

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
  const stored = service.get(result.reviewId);
  assert.equal(stored.schema, 'forge.independent-review.v2');
  assert.equal(stored.reviewContextSha256, result.reviewContextSha256);
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

test('IndependentReviewService keeps review lineage distinct across executor and commit identity', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-lineage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests = [];
  const service = new IndependentReviewService({ file: path.join(root, 'review.sqlite'), reviewer: async (input) => { requests.push(input); return { findings: [] }; } });
  const first = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent-a', reviewerId: 'reviewer', baseSha: 'a', headSha: 'b' });
  const changedHead = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent-a', reviewerId: 'reviewer', baseSha: 'a', headSha: 'c' });
  const changedExecutor = await service.review({ projectId: 'p', diff: DIFF, executorId: 'agent-b', reviewerId: 'reviewer', baseSha: 'a', headSha: 'b' });
  assert.equal(first.deduplicated, false);
  assert.equal(changedHead.deduplicated, false);
  assert.equal(changedExecutor.deduplicated, false);
  assert.notEqual(first.reviewLineageSha256, changedHead.reviewLineageSha256);
  assert.notEqual(first.reviewLineageSha256, changedExecutor.reviewLineageSha256);
  assert.equal(requests.length, 3);
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

test('IndependentReviewService migrates legacy review storage with context evidence', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-schema-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'review.sqlite');
  const legacy = new DatabaseSync(file);
  legacy.exec(`CREATE TABLE independent_reviews(
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, diff_sha256 TEXT NOT NULL, rules_sha256 TEXT NOT NULL,
    executor_id TEXT NOT NULL, reviewer_id TEXT NOT NULL, base_sha TEXT, head_sha TEXT, prior_review_id TEXT,
    full_diff TEXT NOT NULL, reviewed_diff TEXT NOT NULL, findings_json TEXT NOT NULL, receipt_sha256 TEXT NOT NULL,
    created_at INTEGER NOT NULL, UNIQUE(project_id,diff_sha256,rules_sha256,reviewer_id)
  )`);
  legacy.prepare(`INSERT INTO independent_reviews(id,project_id,diff_sha256,rules_sha256,executor_id,reviewer_id,base_sha,head_sha,prior_review_id,full_diff,reviewed_diff,findings_json,receipt_sha256,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('legacy-review', 'p', 'diff', 'rules', 'builder', 'reviewer', 'a', 'b', null, DIFF, DIFF, JSON.stringify([{ fingerprint: 'legacy-fingerprint', source: 'reviewer', message: 'Legacy issue' }]), 'receipt', 1);
  legacy.close();
  const service = new IndependentReviewService({ file, reviewer: async () => ({ findings: [] }) });
  const columns = service.db.prepare('PRAGMA table_info(independent_reviews)').all().map((column) => column.name);
  assert.ok(columns.includes('review_context_sha256'));
  assert.ok(columns.includes('review_lineage_sha256'));
  assert.deepEqual(service.get('legacy-review').findings[0].sources, ['reviewer']);
  service.close();
});

test('IndependentReviewService consolidates identical findings while preserving every source', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-provenance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const finding = { path: 'src/auth.js', line: 2, severity: 'high', category: 'security', message: 'SQL injection', evidence: 'string concatenation' };
  const service = new IndependentReviewService({
    file: path.join(root, 'review.sqlite'),
    reviewer: async () => ({ findings: [finding] }),
    scanners: [{ id: 'security-scan', scan: async () => [finding] }],
  });
  const review = await service.review({ projectId: 'p', diff: DIFF, executorId: 'builder', reviewerId: 'security-reviewer' });
  assert.equal(review.findings.length, 1);
  assert.equal(review.findings[0].source, 'reviewer');
  assert.deepEqual(review.findings[0].sources, ['reviewer', 'scanner:security-scan']);
  const handoff = service.createRepairHandoff(review.reviewId);
  assert.deepEqual(handoff.findings[0].sources, ['reviewer', 'scanner:security-scan']);
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
