import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyHarnessFailure } from '../src/providers/harness-failure-classifier.mjs';

const cases = [
  ['429 rate limit exceeded', 'provider-rate-limit', true],
  ['request timed out after 120000ms', 'provider-timeout', true],
  ['503 model overloaded, try again later', 'provider-overloaded', true],
  ['maximum context length exceeded', 'context-overflow', false],
  ['tool call arguments are invalid JSON', 'malformed-tool-call', true],
  ['Provider requested an unavailable Forge tool: shell.exec', 'unavailable-tool', false],
  ['SANDBOX_POLICY_DENIED outside allowed path', 'sandbox-denied', false],
  ['PATCH_CONFLICT expected sha256 does not match', 'patch-conflict', true],
  ['verification failed: test regression detected', 'test-regression', true],
  ['duplicate action limit reached with no progress', 'loop-no-progress', false],
  ['strange failure', 'unknown', false],
];

for (const [message, expectedClass, retryable] of cases) {
  test(`classifies ${expectedClass}`, () => {
    const result = classifyHarnessFailure(new Error(message), { providerId: 'codex', profileId: 'codex-cli-v1' });
    assert.equal(result.class, expectedClass);
    assert.equal(result.retryable, retryable);
    assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(result, 'message'), false);
  });
}

test('classification fingerprint is stable for equivalent normalized failures and does not include secrets', () => {
  const a = classifyHarnessFailure(Object.assign(new Error('429 API_KEY=secret-123 rate limit'), { code: 'HTTP_429' }), { providerId: 'codex', profileId: 'codex-cli-v1' });
  const b = classifyHarnessFailure(Object.assign(new Error('429 API_KEY=another-secret rate limit'), { code: 'HTTP_429' }), { providerId: 'codex', profileId: 'codex-cli-v1' });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.doesNotMatch(JSON.stringify(a), /secret/i);
});
