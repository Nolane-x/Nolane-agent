import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpoint6DeliveryPlan } from '../src/forensics/checkpoint-6-delivery-plan.mjs';

test('checkpoint 6 delivery plan includes complete local evidence multi-runtime recovery and ablation artifacts', () => {
  const plan = createCheckpoint6DeliveryPlan();
  assert.equal(plan.prefix, 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.6');
  assert.equal(plan.baselineCommit, '9642b442a4155432fba7ca4477f69f4712c70d95');
  for (const file of [
    'datasets/trajectories/multi-runtime-v1/execution-episodes.jsonl',
    'datasets/trajectories/multi-runtime-v1/execution-receipt.json',
    'datasets/trajectories/multi-runtime-v1/recovery-episodes.jsonl',
    'datasets/trajectories/multi-runtime-v1/recovery-receipt.json',
    'datasets/trajectories/multi-runtime-v1/recovery-scenarios.json',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-6.json',
  ]) assert.ok(plan.evidenceFiles.includes(file), file);
  for (const specialist of ['tool-router','context-scorer','test-selector','patch-ranker','risk-classifier']) {
    for (const artifact of ['model.json','benchmark.json','dataset-receipt.json','ablation.json']) {
      assert.ok(plan.evidenceFiles.includes(`models/specialists-checkpoint-6/${specialist}/multi-runtime-v1/${artifact}`));
    }
  }
  for (const suffix of [
    'multi-runtime-execution-receipt.json', 'mutation-recovery-receipt.json',
    'checkpoint-6-specialist-suite-verification.json', 'safe-decision-support.json',
    'unsafe-decision-support.json', 'third-party-provenance.json',
  ]) assert.ok(plan.outputSuffixes.includes(suffix), suffix);
});

import { createCheckpoint6VerificationReport } from '../src/forensics/checkpoint-6-delivery-plan.mjs';

test('checkpoint 6 verification report uses multi-runtime and mutation-recovery fields', () => {
  const report = createCheckpoint6VerificationReport({
    gitHead: 'head', baselineCommit: 'base',
    checkpoint: {
      verification: { status: 'pass' },
      masterLedgerAssertionAudit: { summary: { assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88 } },
      multiRuntimeTrajectories: { episodeCount: 7, runtimes: ['node','go','python'], receiptSha256: 'exec' },
      mutationRecoveryTrajectories: { mutationFailures: 3, recoveryPasses: 3, receiptSha256: 'recovery' },
      checkpoint6SpecialistSuite: {
        verification: { receiptSha256: 'suite' },
        safeDecisionReceipt: { receiptSha256: 'safe' },
        unsafeDecisionReceipt: { receiptSha256: 'unsafe' },
      },
      truthLedger: { unresolved: 7195 },
    },
    matrix: { requiredPassed: 153, requiredTotal: 153, status: 'pass', receiptSha256: 'matrix' },
  });
  assert.match(report, /Multi-runtime trajectories: \*\*7 verified executions across 3 runtimes\*\*/);
  assert.match(report, /Mutation-recovery trajectories: \*\*3 mutation failures and 3 verified recoveries\*\*/);
  assert.doesNotMatch(report, /Repository trajectories/);
});
