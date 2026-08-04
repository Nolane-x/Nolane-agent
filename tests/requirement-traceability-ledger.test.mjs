import test from 'node:test';
import assert from 'node:assert/strict';

import { RequirementTraceabilityLedger } from '../src/construction/requirement-traceability-ledger.mjs';

const specification = {
  specificationId: 'spec-1',
  criteria: [{ criterionId: 'c1', verificationIds: ['verify-c1'] }],
  receiptSha256: 'spec-sha',
};

test('requires a complete criterion-to-verification trace before completion', () => {
  const ledger = new RequirementTraceabilityLedger();
  ledger.registerSpecification(specification);
  ledger.registerNode({ type: 'decision', id: 'd1' });
  ledger.registerNode({ type: 'plan-step', id: 's1' });
  ledger.registerNode({ type: 'symbol', id: 'sym1', sourceHash: 'hash-1' });
  ledger.registerNode({ type: 'test', id: 'test1' });
  ledger.registerNode({ type: 'verification', id: 'verify-c1', status: 'passed', sourceHash: 'hash-1', receiptId: 'receipt-pass' });
  ledger.link({ fromType: 'criterion', fromId: 'c1', relation: 'drives', toType: 'decision', toId: 'd1' });
  ledger.link({ fromType: 'decision', fromId: 'd1', relation: 'implemented-by', toType: 'plan-step', toId: 's1' });
  ledger.link({ fromType: 'plan-step', fromId: 's1', relation: 'changes', toType: 'symbol', toId: 'sym1' });
  ledger.link({ fromType: 'symbol', fromId: 'sym1', relation: 'verified-by', toType: 'test', toId: 'test1' });
  assert.equal(ledger.criterionCompletion('c1').complete, false);
  ledger.link({ fromType: 'test', fromId: 'test1', relation: 'produces', toType: 'verification', toId: 'verify-c1', sourceHash: 'hash-1', receiptId: 'receipt-pass' });
  const result = ledger.criterionCompletion('c1');
  assert.equal(result.complete, true);
  assert.deepEqual(result.verificationIds, ['verify-c1']);
  assert.ok(result.receiptSha256);
});

test('rejects unknown nodes and failed or stale verification evidence', () => {
  const ledger = new RequirementTraceabilityLedger();
  ledger.registerSpecification(specification);
  assert.throws(() => ledger.link({ fromType: 'criterion', fromId: 'c1', relation: 'drives', toType: 'decision', toId: 'missing' }), /unknown target node/i);
  ledger.registerNode({ type: 'verification', id: 'verify-c1', status: 'failed', sourceHash: 'old', receiptId: 'receipt-fail' });
  const result = ledger.criterionCompletion('c1', { currentSourceHashes: { 'verify-c1': 'new' } });
  assert.equal(result.complete, false);
  assert.ok(result.missing.includes('verify-c1'));
});
