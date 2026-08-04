import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpoint8DeliveryPlan, createCheckpoint8VerificationReport } from '../src/forensics/checkpoint-8-delivery-plan.mjs';

test('checkpoint 8 delivery plan includes AST constraint portfolio and promotion evidence', () => {
  const plan = createCheckpoint8DeliveryPlan();
  assert.equal(plan.prefix, 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.8');
  assert.equal(plan.baselineCommit, 'f5564c018ee9aabad313b298e2d2540fb1878316');
  for (const file of [
    'datasets/trajectories/checkpoint-8-v1/mission-portfolio.json',
    'models/checkpoint-8/ast-skill.json',
    'models/checkpoint-8/smt-skill.json',
    'models/checkpoint-8/datalog-skill.json',
    'models/checkpoint-8/ast-transfer.json',
    'models/checkpoint-8/evidence-bundle.json',
    'models/checkpoint-8/pipeline-evidence.json',
    'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-8.json',
  ]) assert.ok(plan.evidenceFiles.includes(file), file);
  for (const suffix of ['mission-portfolio.json', 'ast-skill.json', 'smt-proof.json', 'datalog-proof.json', 'checkpoint-8-pipeline-evidence.json', 'safe-execution.json', 'unsafe-execution.json']) assert.ok(plan.outputSuffixes.includes(suffix), suffix);
});

test('checkpoint 8 verification report states solver transfer proof and locked non-claims', () => {
  const report = createCheckpoint8VerificationReport({
    gitHead: 'head', baselineCommit: 'base',
    checkpoint: {
      verification: { status: 'pass' },
      masterLedgerAssertionAudit: { summary: { assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88 } },
      checkpoint8Pipeline: { portfolio: { missions: [{}, {}, {}, {}, {}], receiptSha256: 'portfolio' }, evidenceBundle: { receiptSha256: 'bundle' }, promotion: { promotions: [{}, {}, {}], receiptSha256: 'promotion' }, safeExecution: { receiptSha256: 'safe' }, unsafeExecution: { receiptSha256: 'unsafe' } },
      truthLedger: { unresolved: 7195 },
    },
    matrix: { requiredPassed: 155, requiredTotal: 155, status: 'pass', receiptSha256: 'matrix' },
  });
  assert.match(report, /Mission portfolio: \*\*5 missions\*\*/);
  assert.match(report, /Promotion v4 skills: \*\*3\/3\*\*/);
  assert.match(report, /NolaneNative function-level parity.*unverified/i);
});
