import test from 'node:test';
import assert from 'node:assert/strict';
import { AgencyLedger } from '../src/cognition/agency-ledger.mjs';

const sha = (char) => char.repeat(64);

test('records independently verified effects without raw commands', () => {
  const ledger = new AgencyLedger();
  const record = ledger.record({
    actionId: 'act-1', taskId: 'task-1', intent: 'restart dev server', commandKind: 'process-start', commandFingerprint: 'cmd-sha',
    expectedEffect: 'new process listens on port 3000', claimedEffect: 'old process remained active', verifiedEffect: 'old process remained active',
    effectVerificationReceiptSha256: sha('a'), observationAtMs: 42, causalAttributionStatus: 'verified',
    controllability: 0.32, responsibleActor: 'environment-supervisor',
  });
  assert.equal(record.controllability, 0.32);
  assert.equal(record.responsibleActor, 'environment-supervisor');
  assert.equal(record.learningEligible, true);
  assert.equal(record.claimedEffect, 'old process remained active');
  assert.equal(record.verifiedEffect, 'old process remained active');
  assert.equal('command' in record, false);
});

test('rejects self-reported effects and does not award credit for unverified attribution', () => {
  const ledger = new AgencyLedger();
  assert.throws(() => ledger.record({
    actionId: 'act-1', taskId: 'task-1', intent: 'restart dev server', commandKind: 'process-start', commandFingerprint: 'cmd-sha',
    expectedEffect: 'server listens', claimedEffect: 'server listens', verifiedEffect: 'server listens',
    observationAtMs: 42, causalAttributionStatus: 'verified', controllability: 1, responsibleActor: 'agent',
  }), /effectVerificationReceiptSha256/i);
  const record = ledger.record({
    actionId: 'act-2', taskId: 'task-1', intent: 'restart dev server', commandKind: 'process-start', commandFingerprint: 'cmd-sha',
    expectedEffect: 'server listens', claimedEffect: 'server listens', verifiedEffect: 'server listens',
    effectVerificationReceiptSha256: sha('b'), observationAtMs: 43, causalAttributionStatus: 'inconclusive',
    controllability: 1, responsibleActor: 'agent',
  });
  assert.equal(record.learningEligible, false);
});
