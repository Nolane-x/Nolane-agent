import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { compareDifferentialBehavior } from '../src/nolane-native/operational-boundary-service.mjs';

test('Nolane compares accepted behavior contracts without importing or executing an external runtime', () => {
  const contract = [
    { id: 'cli-health', expected: { status: 'ok' } },
    { id: 'secret-redaction', expected: { secretExposed: false } },
    { id: 'path-traversal', expected: { allowed: false, code: 'WORKSPACE_BOUNDARY' } },
  ];
  const receipt = compareDifferentialBehavior({ contract, observed: [
    { id: 'cli-health', actual: { status: 'ok' } },
    { id: 'secret-redaction', actual: { secretExposed: false } },
    { id: 'path-traversal', actual: { allowed: false, code: 'WORKSPACE_BOUNDARY' } },
  ] });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.importedThirdPartyRuntime, false);
  assert.equal(receipt.executedThirdPartyRuntime, false);
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('Differential behavior reports exact mismatches', () => {
  const receipt = compareDifferentialBehavior({
    contract: [{ id: 'x', expected: { allowed: false } }],
    observed: [{ id: 'x', actual: { allowed: true } }],
  });
  assert.equal(receipt.status, 'fail');
  assert.deepEqual(receipt.mismatches, ['x']);
});

test('Nolane release preserves neutral clean-room attribution without distributing external runtime artifacts', async () => {
  const [license, notices, ledger] = await Promise.all([
    readFile(new URL('../LICENSE', import.meta.url), 'utf8'),
    readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'),
    readFile(new URL('../requirements/nolane-native-transformation-ledger.jsonl', import.meta.url), 'utf8'),
  ]);
  assert.match(license, /MIT License/);
  assert.match(license, /Nolane Agent contributors/);
  assert.match(notices, /Historical clean-room research input/);
  assert.match(notices, /Copyright \(c\) 2025 Nous Research/);
  assert.match(notices, /No upstream archive, runtime, API route, executable integration, model profile, adapter, or package is distributed/);
  assert.match(notices, /requirements\/nolane-native-transformation-ledger\.jsonl/);
  assert.equal(ledger.trim().split('\n').length > 8_000, true);
});
