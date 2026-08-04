import test from 'node:test';
import assert from 'node:assert/strict';

import { VerificationClaimGuard } from '../src/security/verification-claim-guard.mjs';

const guard = new VerificationClaimGuard();

test('VerificationClaimGuard blocks unsupported success claims and undisclosed errors', () => {
  const result = guard.assess({
    output: 'All tests passed. The implementation is complete and the bug is fixed.',
    receipts: [],
    activity: {
      filesWritten: ['src/app.mjs'],
      commandsRun: [{ command: 'npm', args: ['test'], exitCode: 1 }],
      errors: [{ code: 'TEST_FAILED', message: 'npm test exited 1' }],
      stepResults: [],
    },
  });
  assert.equal(result.status, 'blocked-unverified-claims');
  assert.deepEqual([...result.unsupportedClaims].sort(), ['completion', 'fix', 'test-success']);
  assert.equal(result.undisclosedErrorCount, 1);
  assert.match(result.safeOutput, /UNVERIFIED CLAIMS/i);
  assert.match(result.safeOutput, /npm test exited 1/i);
  assert.match(result.assessmentSha256, /^[a-f0-9]{64}$/);
});

test('VerificationClaimGuard supports test, fix, and completion claims only with matching successful evidence', () => {
  const receipt = { tool: 'process.run', status: 'pass', receiptSha256: 'a'.repeat(64) };
  const result = guard.assess({
    output: 'All tests passed. The implementation is complete and the bug is fixed.',
    receipts: [receipt],
    activity: {
      filesWritten: ['src/app.mjs'],
      commandsRun: [{ command: 'npm', args: ['test'], exitCode: 0 }],
      errors: [],
      stepResults: [{ id: receipt.receiptSha256, tool: 'process.run', status: 'pass', result: { exitCode: 0 } }],
    },
  });
  assert.equal(result.status, 'supported-candidate');
  assert.deepEqual(result.unsupportedClaims, []);
  assert.equal(result.safeOutput, result.originalOutput);
  assert.deepEqual(result.evidenceReceiptSha256, ['a'.repeat(64)]);
});

test('VerificationClaimGuard leaves ordinary candidate text unchanged', () => {
  const result = guard.assess({ output: 'I changed src/app.mjs and recommend running the project test suite.', receipts: [], activity: {} });
  assert.equal(result.status, 'candidate');
  assert.deepEqual(result.claims, []);
  assert.equal(result.safeOutput, result.originalOutput);
});
