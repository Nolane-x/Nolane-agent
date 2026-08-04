import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiExistenceGate } from '../src/verification/api-existence-gate.mjs';

const gate = new ApiExistenceGate();
const receipt = (char) => char.repeat(64);

test('allows an API only when exact compatible evidence exists', () => {
  const decision = gate.verify({
    request: { kind: 'symbol', name: 'readFile', package: 'node:fs/promises', signature: '(path, options?)', platform: 'linux' },
    evidence: [{ kind: 'lsp-symbol', name: 'readFile', package: 'node:fs/promises', signature: '(path, options?)', platforms: ['linux', 'darwin', 'win32'], deprecated: false, receiptSha256: receipt('a') }],
    required: true,
  });
  assert.equal(decision.status, 'pass');
  assert.equal(decision.allowed, true);
  assert.equal(decision.matches.length, 1);
});

test('blocks missing package and unknown evidence', () => {
  const missing = gate.verify({ request: { kind: 'package', name: 'imaginary-lib', versionRange: '^1.0.0' }, evidence: [], required: true });
  assert.equal(missing.status, 'unknown');
  assert.equal(missing.allowed, false);
  assert.ok(missing.reasons.includes('no-exact-evidence'));
});

test('blocks version, signature, deprecation, and platform incompatibility', () => {
  const cases = [
    {
      request: { kind: 'package', name: 'demo', versionRange: '^2.0.0' },
      evidence: [{ kind: 'lockfile-package', name: 'demo', version: '1.9.0', receiptSha256: receipt('b') }],
      reason: 'version-incompatible',
    },
    {
      request: { kind: 'symbol', name: 'open', package: 'demo', signature: '(path)' },
      evidence: [{ kind: 'lsp-symbol', name: 'open', package: 'demo', signature: '(path, flags)', receiptSha256: receipt('c') }],
      reason: 'signature-mismatch',
    },
    {
      request: { kind: 'symbol', name: 'legacy', package: 'demo' },
      evidence: [{ kind: 'lsp-symbol', name: 'legacy', package: 'demo', deprecated: true, receiptSha256: receipt('d') }],
      reason: 'deprecated-without-exception',
    },
    {
      request: { kind: 'symbol', name: 'watch', package: 'demo', platform: 'win32' },
      evidence: [{ kind: 'capability-probe', name: 'watch', package: 'demo', platforms: ['linux'], receiptSha256: receipt('e') }],
      reason: 'platform-unsupported',
    },
  ];
  for (const item of cases) {
    const decision = gate.verify({ request: item.request, evidence: item.evidence, required: true });
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.includes(item.reason), `${item.reason}: ${decision.reasons}`);
  }
});
