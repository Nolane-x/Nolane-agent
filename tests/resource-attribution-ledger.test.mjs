import assert from 'node:assert/strict';
import test from 'node:test';
import { ResourceAttributionLedger } from '../src/runtime/resource-attribution-ledger.mjs';
const sha = (c) => c.repeat(64);

test('integrates RSS by trapezoid and aggregates resource through mission hierarchy', () => {
  const ledger = new ResourceAttributionLedger();
  ledger.registerResource({ resourceId: 'r1', decisionId: 'd1', taskId: 't1', milestoneId: 'ms1', missionId: 'm1', registrationReceiptSha256: sha('a') });
  ledger.sample({ resourceId: 'r1', sampleId: 's1', atMs: 0, rssMb: 100, sourceReceiptSha256: sha('b') });
  ledger.sample({ resourceId: 'r1', sampleId: 's2', atMs: 10_000, rssMb: 300, sourceReceiptSha256: sha('c') });
  ledger.finalize({ resourceId: 'r1', sampleId: 's3', atMs: 20_000, rssMb: 100, sourceReceiptSha256: sha('d') });
  for (const scope of [{ resourceId: 'r1' }, { decisionId: 'd1' }, { taskId: 't1' }, { milestoneId: 'ms1' }, { missionId: 'm1' }]) {
    const result = ledger.snapshot(scope);
    assert.equal(result.rssMbSeconds, 4_000);
    assert.equal(result.resourceCount, 1);
  }
});

test('keeps identical samples idempotent and rejects conflicts or out-of-order time', () => {
  const ledger = new ResourceAttributionLedger();
  ledger.registerResource({ resourceId: 'r1', decisionId: 'd1', taskId: 't1', milestoneId: 'ms1', missionId: 'm1', registrationReceiptSha256: sha('a') });
  ledger.sample({ resourceId: 'r1', sampleId: 's1', atMs: 100, rssMb: 10, sourceReceiptSha256: sha('b') });
  const duplicate = ledger.sample({ resourceId: 'r1', sampleId: 's1', atMs: 100, rssMb: 10, sourceReceiptSha256: sha('b') });
  assert.equal(duplicate.duplicate, true);
  assert.throws(() => ledger.sample({ resourceId: 'r1', sampleId: 's1', atMs: 100, rssMb: 11, sourceReceiptSha256: sha('c') }), /sample conflict/i);
  assert.throws(() => ledger.sample({ resourceId: 'r1', sampleId: 's2', atMs: 99, rssMb: 10, sourceReceiptSha256: sha('d') }), /monotonic/i);
});

test('rejects hierarchy conflicts and samples after finalization', () => {
  const ledger = new ResourceAttributionLedger();
  ledger.registerResource({ resourceId: 'r1', decisionId: 'd1', taskId: 't1', milestoneId: 'ms1', missionId: 'm1', registrationReceiptSha256: sha('a') });
  assert.throws(() => ledger.registerResource({ resourceId: 'r1', decisionId: 'd2', taskId: 't1', milestoneId: 'ms1', missionId: 'm1', registrationReceiptSha256: sha('b') }), /resource conflict/i);
  ledger.sample({ resourceId: 'r1', sampleId: 's1', atMs: 0, rssMb: 10, sourceReceiptSha256: sha('c') });
  ledger.finalize({ resourceId: 'r1', sampleId: 's2', atMs: 1_000, rssMb: 10, sourceReceiptSha256: sha('d') });
  assert.throws(() => ledger.sample({ resourceId: 'r1', sampleId: 's3', atMs: 2_000, rssMb: 10, sourceReceiptSha256: sha('e') }), /finalized/i);
});
