import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedJsonParse, assertSafeValue, containsSecret, requireHumanConfirmation, escapeHtml } from '../src/core/security.mjs';

test('security boundary rejects oversized and dangerous object input', () => {
  assert.throws(() => boundedJsonParse('{"x":"' + 'a'.repeat(1000) + '"}', 100), /too large/i);
  const polluted = JSON.parse('{"__proto__":{"admin":true}}');
  assert.throws(() => assertSafeValue(polluted), /dangerous key/i);
});

test('secret detector catches common credential material without logging it', () => {
  assert.equal(containsSecret('OPENAI_API_KEY=sk-' + 'a'.repeat(32)), true);
  assert.equal(containsSecret('This is an architecture summary.'), false);
});

test('irreversible actions require an explicit matching confirmation', () => {
  assert.throws(() => requireHumanConfirmation({ action: 'release', confirmation: 'yes' }), /confirmation/i);
  assert.doesNotThrow(() => requireHumanConfirmation({ action: 'release', confirmation: 'CONFIRM release' }));
});

test('HTML escaping neutralizes active markup', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('secret detector catches JWT, npm, Slack, Hugging Face, database credentials, and session cookies',()=>{
  const samples=[
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'npm_abcdefghijklmnopqrstuvwxyz0123456789',
    'xoxb-' + 'a'.repeat(20),
    'hf_abcdefghijklmnopqrstuvwxyz1234567890',
    'postgresql://admin:supersecret@example.com:5432/app',
    'session=abcdef0123456789abcdef0123456789abcdef0123456789',
  ];
  for(const sample of samples)assert.equal(containsSecret(sample),true,sample);
});

test('secret detector treats non-serializable values as unsafe rather than crashing ambiguously',()=>{
  assert.throws(()=>containsSecret({value:1n}),/serializable|secret screening/i);
});
