import test from 'node:test';
import assert from 'node:assert/strict';

import { InvariantLedger } from '../src/construction/invariant-ledger.mjs';

test('critical invariant failure blocks patch authorization', () => {
  const ledger = new InvariantLedger();
  ledger.register({ invariantId: 'no-secret-log', owner: 'security', severity: 'critical', verifierId: 'secret-scan', protectedScopes: ['src/**'], sourceHash: 'hash-1' });
  ledger.recordVerification('no-secret-log', { status: 'failed', sourceHash: 'hash-1', receiptId: 'scan-fail' });
  const result = ledger.authorize({ changedPaths: ['src/auth.mjs'], currentSourceHashes: { 'no-secret-log': 'hash-1' } });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockingInvariantIds, ['no-secret-log']);
});

test('warning invariant reports without blocking and stale pass is rejected', () => {
  const ledger = new InvariantLedger();
  ledger.register({ invariantId: 'style', owner: 'quality', severity: 'warning', verifierId: 'lint', protectedScopes: ['src/**'], sourceHash: 'hash-1' });
  ledger.recordVerification('style', { status: 'passed', sourceHash: 'hash-1', receiptId: 'lint-pass' });
  const stale = ledger.authorize({ changedPaths: ['src/a.mjs'], currentSourceHashes: { style: 'hash-2' } });
  assert.equal(stale.allowed, true);
  assert.deepEqual(stale.warningInvariantIds, ['style']);
  assert.deepEqual(stale.staleInvariantIds, ['style']);
});

test('active invariant can only be replaced by an explicit supersede receipt', () => {
  const ledger = new InvariantLedger();
  ledger.register({ invariantId: 'api-stable', owner: 'architecture', severity: 'critical', verifierId: 'api-diff', protectedScopes: ['src/api/**'], sourceHash: 'hash-1' });
  assert.throws(() => ledger.register({ invariantId: 'api-stable', owner: 'architecture', severity: 'critical', verifierId: 'api-diff-v2', protectedScopes: ['src/api/**'], sourceHash: 'hash-2' }), /supersede receipt/i);
  const revised = ledger.register({ invariantId: 'api-stable', owner: 'architecture', severity: 'critical', verifierId: 'api-diff-v2', protectedScopes: ['src/api/**'], sourceHash: 'hash-2', supersedesReceiptId: 'approved-revision' });
  assert.equal(revised.revision, 2);
});
