import test from 'node:test';
import assert from 'node:assert/strict';

import { TestIntegrityGuard } from '../src/verification/test-integrity-guard.mjs';

const guard = new TestIntegrityGuard();

function assessment(diff, extra = {}) {
  return guard.assess({ diff, sourceHash: 'a'.repeat(64), ...extra });
}

test('blocks deleted, skipped, focused, weakened, and broadly mocked tests', () => {
  const result = assessment(`diff --git a/tests/auth.test.mjs b/tests/auth.test.mjs
--- a/tests/auth.test.mjs
+++ b/tests/auth.test.mjs
@@ -1,7 +1,7 @@
-test('rejects expired tokens', () => {
-  assert.equal(result.status, 401);
-  assert.throws(() => validate('bad'));
+test.skip('rejects expired tokens', () => {
+  assert.ok(result);
+  mock.module('../src/auth.mjs');
 });
+test.only('happy path', () => assert.ok(true));
`);
  const categories = new Set(result.findings.map((item) => item.category));
  for (const category of ['test-skip', 'focused-test', 'assertion-weakened', 'negative-case-removed', 'broad-mock']) assert.ok(categories.has(category), `missing ${category}`);
  assert.equal(result.allowedAsCompletionEvidence, false);
  assert.equal(result.blockingFindings > 0, true);
});

test('requires repeated consistent evidence for a flaky test', () => {
  const onePass = assessment('diff --git a/src/a.mjs b/src/a.mjs\n+export const a = 1;\n', {
    testRuns: [{ testId: 'flaky-auth', status: 'pass', flaky: true, receiptSha256: 'b'.repeat(64) }],
  });
  assert.equal(onePass.allowedAsCompletionEvidence, false);
  assert.ok(onePass.findings.some((item) => item.category === 'flaky-single-pass'));

  const repeated = assessment('diff --git a/src/a.mjs b/src/a.mjs\n+export const a = 1;\n', {
    testRuns: [
      { testId: 'flaky-auth', status: 'pass', flaky: true, receiptSha256: 'b'.repeat(64) },
      { testId: 'flaky-auth', status: 'pass', flaky: true, receiptSha256: 'c'.repeat(64) },
    ],
  });
  assert.equal(repeated.allowedAsCompletionEvidence, true);
});

test('accepts unchanged strong tests with a mutation receipt', () => {
  const result = assessment('diff --git a/src/a.mjs b/src/a.mjs\n+export const a = 1;\n', {
    testRuns: [{ testId: 'a-test', status: 'pass', flaky: false, receiptSha256: 'd'.repeat(64) }],
    mutationReceipt: { status: 'pass', killed: 3, survived: 0, receiptSha256: 'e'.repeat(64) },
  });
  assert.equal(result.findings.length, 0);
  assert.equal(result.allowedAsCompletionEvidence, true);
  assert.equal(result.claims.testGreenAloneSufficient, false);
});
