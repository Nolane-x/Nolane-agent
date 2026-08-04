import test from 'node:test';
import assert from 'node:assert/strict';

import { ProspectiveObligationLedger } from '../src/construction/prospective-obligation-ledger.mjs';

test('fires obligations only after matching state evidence and requires completion proof', () => {
  const ledger = new ProspectiveObligationLedger();
  ledger.register({ obligationId: 'cleanup-adapter', trigger: { type: 'state', key: 'migration', equals: 'completed' }, action: 'run-compatibility-suite', requiredVerificationIds: ['compat-suite'] });
  assert.throws(() => ledger.complete('cleanup-adapter', { verificationIds: ['compat-suite'], receiptId: 'early' }), /not triggered/i);
  const ignored = ledger.observe({ eventId: 'e1', type: 'state', key: 'migration', value: 'running', receiptId: 'state-running' });
  assert.equal(ignored.triggeredObligationIds.length, 0);
  const fired = ledger.observe({ eventId: 'e2', type: 'state', key: 'migration', value: 'completed', receiptId: 'state-complete' });
  assert.deepEqual(fired.triggeredObligationIds, ['cleanup-adapter']);
  const complete = ledger.complete('cleanup-adapter', { verificationIds: ['compat-suite'], receiptId: 'compat-pass' });
  assert.equal(complete.status, 'completed');
});
