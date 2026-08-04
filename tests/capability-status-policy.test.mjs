import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCapabilityStatusRecord, validateCapabilityTransition } from '../src/audit/capability-status-policy.mjs';

test('capability status policy keeps implemented-not-wired separate from verified production behavior', () => {
  const pending = validateCapabilityStatusRecord({ id: 'X', status: 'implemented_not_wired', acceptance: { entrypoint: 'src/x.mjs', exactTest: 'tests/x.test.mjs' } });
  assert.equal(pending.countsAsVerified, false);
  assert.throws(() => validateCapabilityTransition({ from: 'implemented_not_wired', to: 'verified_source_test', productionWired: false, replayReceiptSha256: 'a'.repeat(64) }), /production wiring/i);
  const promoted = validateCapabilityTransition({ from: 'implemented_not_wired', to: 'verified_source_test', productionWired: true, replayReceiptSha256: 'a'.repeat(64) });
  assert.equal(promoted.allowed, true);
  assert.throws(() => validateCapabilityStatusRecord({ id: 'Y', status: 'implemented_not_wired', acceptance: {} }), /entrypoint|exact test/i);
});
