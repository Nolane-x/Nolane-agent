import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpoint7DeliveryPlan, createCheckpoint7VerificationReport } from '../src/forensics/checkpoint-7-delivery-plan.mjs';

test('checkpoint 7 delivery plan includes held-out mission process reward skill transfer and promotion evidence', () => {
  const plan = createCheckpoint7DeliveryPlan();
  assert.equal(plan.prefix, 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.7');
  assert.equal(plan.baselineCommit, '71274e1c9d729070c80a59fb0e9b33acc466d9e7');
  for (const file of [
    'datasets/trajectories/checkpoint-7-v1/mission-collection.json',
    'models/process-reward-checkpoint-7/model.json',
    'models/process-reward-checkpoint-7/benchmark.json',
    'models/checkpoint-7/verified-skill.json',
    'models/checkpoint-7/skill-transfer.json',
    'models/checkpoint-7/pipeline-evidence.json',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-7.json',
  ]) assert.ok(plan.evidenceFiles.includes(file), file);
  for (const suffix of ['mission-collection.json','process-reward-model.json','verified-skill.json','skill-transfer.json','checkpoint-7-pipeline-evidence.json','safe-decision-support.json','unsafe-decision-support.json']) {
    assert.ok(plan.outputSuffixes.includes(suffix), suffix);
  }
});

test('checkpoint 7 verification report states transfer process cost and locked non-claims', () => {
  const report = createCheckpoint7VerificationReport({
    gitHead: 'head', baselineCommit: 'base',
    checkpoint: {
      verification: { status: 'pass' },
      masterLedgerAssertionAudit: { summary: { assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88 } },
      checkpoint7Pipeline: { missionCollection: { primaryMissions: [{}, {}, {}], inductionMissions: [{}, {}], receiptSha256: 'missions' }, processVerification: { receiptSha256: 'process' }, skillTransfer: { receiptSha256: 'transfer' }, promotion: { specialistPromotions: [{}, {}, {}, {}, {}], receiptSha256: 'promotion' }, safeDecisionReceipt: { receiptSha256: 'safe' }, unsafeDecisionReceipt: { receiptSha256: 'unsafe' } },
      truthLedger: { unresolved: 7195 },
    },
    matrix: { requiredPassed: 154, requiredTotal: 154, status: 'pass', receiptSha256: 'matrix' },
  });
  assert.match(report, /Held-out mission trajectories: \*\*3 primary and 2 induction\*\*/);
  assert.match(report, /Promotion v3 specialists: \*\*5\/5\*\*/);
  assert.match(report, /General coding intelligence.*remain unverified/i);
});
