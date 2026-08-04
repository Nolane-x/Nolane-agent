import assert from 'node:assert/strict';
import test from 'node:test';

import { VerifiedOutcomeLedger } from '../src/decision/verified-outcome-ledger.mjs';

const sha = (char) => char.repeat(64);

function fixture() {
  let now = 1_000;
  const ledger = new VerifiedOutcomeLedger({ clock: () => now });
  ledger.registerMission({ missionId: 'mission-1' });
  ledger.registerMilestone({ missionId: 'mission-1', milestoneId: 'milestone-1' });
  ledger.registerTask({
    missionId: 'mission-1', milestoneId: 'milestone-1', taskId: 'task-1',
    criteria: [
      { criterionId: 'criterion-a', weight: 2 },
      { criterionId: 'criterion-b', weight: 3 },
    ],
  });
  ledger.registerDecision({ missionId: 'mission-1', milestoneId: 'milestone-1', taskId: 'task-1', decisionId: 'decision-1' });
  return { ledger, setNow(value) { now = value; } };
}

test('verified receipts propagate criterion score from task to milestone and mission', () => {
  const { ledger } = fixture();
  const passing = ledger.recordVerification({
    decisionId: 'decision-1', verificationId: 'verify-1', status: 'pass', receiptSha256: sha('a'),
    verifiedCriterionIds: ['criterion-a'], independentEvidenceReceiptSha256: sha('b'),
  });
  assert.equal(passing.applied, true);
  assert.deepEqual(ledger.score({ taskId: 'task-1' }), {
    schema: 'forge.verified-outcome-score.v1', scope: { type: 'task', id: 'task-1' },
    totalCriteriaWeight: 5, verifiedCriteriaScore: 2, completionRatio: 0.4,
    verifiedCriterionIds: ['criterion-a'], contributingVerificationReceipts: [sha('a')],
    receiptSha256: ledger.score({ taskId: 'task-1' }).receiptSha256,
  });
  assert.equal(ledger.score({ milestoneId: 'milestone-1' }).verifiedCriteriaScore, 2);
  assert.equal(ledger.score({ missionId: 'mission-1' }).verifiedCriteriaScore, 2);

  const failed = ledger.recordVerification({
    decisionId: 'decision-1', verificationId: 'verify-2', status: 'fail', receiptSha256: sha('c'),
    verifiedCriterionIds: ['criterion-b'], independentEvidenceReceiptSha256: sha('d'),
  });
  assert.equal(failed.applied, false);
  assert.equal(ledger.score({ missionId: 'mission-1' }).verifiedCriteriaScore, 2);

  const duplicate = ledger.recordVerification({
    decisionId: 'decision-1', verificationId: 'verify-1', status: 'pass', receiptSha256: sha('a'),
    verifiedCriterionIds: ['criterion-a'], independentEvidenceReceiptSha256: sha('b'),
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(ledger.score({ taskId: 'task-1' }).verifiedCriteriaScore, 2);
});

test('context usefulness is derived from passing verification links rather than caller totals', () => {
  const { ledger } = fixture();
  ledger.recordContextSelection({
    decisionId: 'decision-1', selectionId: 'selection-1', receiptSha256: sha('e'),
    cards: [
      { cardId: 'card-a', tokenCount: 100, receiptSha256: sha('1') },
      { cardId: 'card-b', tokenCount: 50, receiptSha256: sha('2') },
      { cardId: 'card-c', tokenCount: 30, receiptSha256: sha('3') },
    ],
    contextTokensActuallyUseful: 999_999,
  });
  ledger.recordVerification({
    decisionId: 'decision-1', verificationId: 'verify-context', status: 'pass', receiptSha256: sha('f'),
    verifiedCriterionIds: ['criterion-a'], independentEvidenceReceiptSha256: sha('4'),
    usefulContext: [{ cardId: 'card-a', reason: 'criterion', evidenceReceiptSha256: sha('5') }],
    contradictedContext: [{ cardId: 'card-c', evidenceReceiptSha256: sha('6') }],
  });
  const utility = ledger.contextUtility({ decisionId: 'decision-1' });
  assert.equal(utility.contextTokensSelected, 180);
  assert.equal(utility.contextTokensActuallyUseful, 100);
  assert.equal(utility.contextTokensContradicted, 30);
  assert.equal(utility.contextTokensUnused, 50);
  assert.deepEqual(utility.usefulCardIds, ['card-a']);
  assert.deepEqual(utility.contradictedCardIds, ['card-c']);
  assert.equal(JSON.stringify(utility).includes('999999'), false);
});

test('all cost categories are attributed through decision, task, milestone, and mission', () => {
  const { ledger } = fixture();
  for (const [index, category, amount] of [
    [1, 'token', 1_000], [2, 'tool', 2], [3, 'model', 0.25], [4, 'process', 600], [5, 'context', 180],
  ]) {
    ledger.recordCost({ costId: `cost-${index}`, decisionId: 'decision-1', category, amount, unit: category === 'model' ? 'usd' : 'units', receiptSha256: String(index).repeat(64) });
  }
  const decision = ledger.cost({ decisionId: 'decision-1' });
  assert.equal(decision.totalObservations, 5);
  assert.deepEqual(decision.byCategory, { context: 180, model: 0.25, process: 600, token: 1000, tool: 2 });
  assert.deepEqual(ledger.cost({ taskId: 'task-1' }).byCategory, decision.byCategory);
  assert.deepEqual(ledger.cost({ milestoneId: 'milestone-1' }).byCategory, decision.byCategory);
  assert.deepEqual(ledger.cost({ missionId: 'mission-1' }).byCategory, decision.byCategory);
  assert.throws(() => ledger.recordCost({ costId: 'unknown', decisionId: 'missing', category: 'tool', amount: 1, unit: 'call', receiptSha256: sha('9') }), /unknown decision/i);
});

test('verification fails closed for unknown criteria or invalid independent evidence', () => {
  const { ledger } = fixture();
  assert.throws(() => ledger.recordVerification({ decisionId: 'decision-1', verificationId: 'bad-1', status: 'pass', receiptSha256: sha('a'), verifiedCriterionIds: ['missing'], independentEvidenceReceiptSha256: sha('b') }), /unknown criterion/i);
  assert.throws(() => ledger.recordVerification({ decisionId: 'decision-1', verificationId: 'bad-2', status: 'pass', receiptSha256: sha('a'), verifiedCriterionIds: ['criterion-a'], independentEvidenceReceiptSha256: 'not-a-hash' }), /SHA-256/i);
});
