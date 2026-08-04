import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpoint9DeliveryPlan, createCheckpoint9VerificationReport } from '../src/forensics/checkpoint-9-delivery-plan.mjs';

test('checkpoint 9 delivery plan includes portfolio, transfer, property, promotion, and pipeline evidence', () => {
  const plan = createCheckpoint9DeliveryPlan();
  assert.equal(plan.baselineCommit, '73443a7353b7f0bc8bacb75a247ac0c610f73b33');
  for (const file of [
    'datasets/trajectories/checkpoint-9-v1/mission-portfolio.json',
    'models/checkpoint-9/refactor-skill.json',
    'models/checkpoint-9/refactor-transfer.json',
    'models/checkpoint-9/smt-properties.json',
    'models/checkpoint-9/datalog-properties.json',
    'models/checkpoint-9/evidence-bundle.json',
    'models/checkpoint-9/promotion.json',
    'models/checkpoint-9/pipeline-evidence.json',
  ]) assert.ok(plan.evidenceFiles.includes(file), file);
  for (const suffix of ['mission-portfolio.json', 'refactor-skill.json', 'refactor-transfer.json', 'smt-properties.json', 'datalog-properties.json', 'checkpoint-9-pipeline-evidence.json', 'safe-execution.json', 'unsafe-execution.json']) assert.ok(plan.outputSuffixes.includes(suffix), suffix);
});

test('checkpoint 9 verification report names matrix 156 and protected non-claims', () => {
  const report = createCheckpoint9VerificationReport({
    gitHead: 'head', baselineCommit: 'base',
    checkpoint: { verification: { status: 'pass' }, masterLedgerAssertionAudit: { summary: { assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88 } }, checkpoint9Pipeline: { portfolio: { missions: Array(5), receiptSha256: 'portfolio' }, evidenceBundle: { receiptSha256: 'bundle' }, promotion: { receiptSha256: 'promotion' }, safeExecution: { receiptSha256: 'safe' }, unsafeExecution: { receiptSha256: 'unsafe' } }, truthLedger: { unresolved: 7195 } },
    matrix: { requiredPassed: 156, requiredTotal: 156, status: 'pass', receiptSha256: 'matrix' },
  });
  assert.match(report, /156\/156/);
  assert.match(report, /general coding intelligence/i);
  assert.match(report, /NolaneNative function-level parity remains unverified/i);
});
