import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { AcceptanceCriteriaLedger } from '../src/decision/acceptance-criteria-ledger.mjs';

function receipt(input = {}) {
  const base = {
    schema: 'forge.acceptance-criterion-verification.v1',
    taskId: 'task-1',
    criterionId: 'root-fixed',
    status: 'pass',
    sourceHash: 'a'.repeat(64),
    verifier: 'targeted-test',
    verifiedAtMs: 100,
    ...input,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

test('AcceptanceCriteriaLedger gives unverified criteria zero score and credits exact verified weight', () => {
  const ledger = new AcceptanceCriteriaLedger({ clock: () => 100 });
  ledger.registerTask('task-1', [
    { criterionId: 'root-fixed', description: 'Root cause is removed', weight: 4, sourceHash: 'a'.repeat(64) },
    { criterionId: 'old-tests', description: 'Existing tests still pass', weight: 3, sourceHash: 'b'.repeat(64) },
  ]);

  assert.equal(ledger.snapshot('task-1').verifiedCriteriaScore, 0);
  ledger.recordVerification('task-1', 'root-fixed', receipt());
  const snapshot = ledger.snapshot('task-1');
  assert.equal(snapshot.verifiedCriteriaScore, 4);
  assert.equal(snapshot.totalCriteriaWeight, 7);
  assert.equal(snapshot.completionRatio, 4 / 7);
  assert.equal(snapshot.criteria.find((item) => item.criterionId === 'old-tests').verified, false);
});

test('AcceptanceCriteriaLedger rejects duplicate IDs and invalid or unbounded weights', () => {
  const ledger = new AcceptanceCriteriaLedger();
  assert.throws(() => ledger.registerTask('task-1', [
    { criterionId: 'same', description: 'A', weight: 1, sourceHash: 'a'.repeat(64) },
    { criterionId: 'same', description: 'B', weight: 2, sourceHash: 'b'.repeat(64) },
  ]), /duplicate criterionId/i);
  assert.throws(() => ledger.registerTask('task-2', [{ criterionId: 'x', description: 'X', weight: 0, sourceHash: 'a'.repeat(64) }]), /weight/i);
  assert.throws(() => ledger.registerTask('task-3', [{ criterionId: 'x', description: 'X', weight: 101, sourceHash: 'a'.repeat(64) }]), /weight/i);
});

test('AcceptanceCriteriaLedger ignores failed verification and rejects stale or forged receipts', () => {
  const ledger = new AcceptanceCriteriaLedger({ clock: () => 200 });
  ledger.registerTask('task-1', [{ criterionId: 'root-fixed', description: 'Root cause is removed', weight: 4, sourceHash: 'a'.repeat(64) }]);

  ledger.recordVerification('task-1', 'root-fixed', receipt({ status: 'fail' }));
  assert.equal(ledger.snapshot('task-1').verifiedCriteriaScore, 0);

  assert.throws(() => ledger.recordVerification('task-1', 'root-fixed', receipt({ sourceHash: 'b'.repeat(64) })), /stale source hash/i);
  assert.throws(() => ledger.recordVerification('task-1', 'root-fixed', { ...receipt(), receiptSha256: 'f'.repeat(64) }), /receipt sha-256/i);
});

test('AcceptanceCriteriaLedger snapshots are immutable and deterministically hashed', () => {
  const ledger = new AcceptanceCriteriaLedger({ clock: () => 300 });
  ledger.registerTask('task-1', [{ criterionId: 'root-fixed', description: 'Root cause is removed', weight: 4, sourceHash: 'a'.repeat(64) }]);
  const a = ledger.snapshot('task-1');
  const b = ledger.snapshot('task-1');
  assert.equal(a.receiptSha256, b.receiptSha256);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.criteria), true);
  assert.throws(() => { a.criteria[0].weight = 99; }, TypeError);
});
