import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpoint10DeliveryPlan, createCheckpoint10VerificationReport } from '../src/forensics/checkpoint-10-delivery-plan.mjs';

test('checkpoint 10 delivery plan includes TypeScript transfer, properties, cross-language, promotion, and pipeline evidence', () => {
  const plan = createCheckpoint10DeliveryPlan();
  assert.equal(plan.baselineCommit, '63b69383df55464226b75556bc82d48a35f0a84a');
  for (const file of [
    'datasets/trajectories/checkpoint-10-v1/mission-portfolio.json',
    'models/checkpoint-10/typescript-skill.json',
    'models/checkpoint-10/typescript-transfer.json',
    'models/checkpoint-10/typescript-properties.json',
    'models/checkpoint-10/cross-language-migration.json',
    'models/checkpoint-10/evidence-bundle.json',
    'models/checkpoint-10/promotion.json',
    'models/checkpoint-10/pipeline-evidence.json',
  ]) assert.ok(plan.evidenceFiles.includes(file), file);
  for (const suffix of ['mission-portfolio.json', 'typescript-skill.json', 'typescript-transfer.json', 'typescript-properties.json', 'cross-language-migration.json', 'checkpoint-10-pipeline-evidence.json', 'safe-typescript-execution.json', 'safe-contract-migration.json', 'unsafe-execution.json']) assert.ok(plan.outputSuffixes.includes(suffix), suffix);
});

test('checkpoint 10 verification report names matrix 157 and protected non-claims', () => {
  const report = createCheckpoint10VerificationReport({
    gitHead: 'head', baselineCommit: 'base',
    checkpoint: { verification: { status: 'pass' }, masterLedgerAssertionAudit: { summary: { assertionVerified: 1372, assertionUnbound: 0, externalUnverified: 88 } }, checkpoint10Pipeline: { portfolio: { missions: Array(5), receiptSha256: 'portfolio', typescriptTransfer: { receiptSha256: 'transfer' }, typescriptProperties: { receiptSha256: 'properties' }, contractMigration: { receiptSha256: 'contract' } }, evidenceBundle: { receiptSha256: 'bundle' }, promotion: { receiptSha256: 'promotion' }, safeTypeScriptExecution: { receiptSha256: 'safe-ts' }, safeContractMigration: { receiptSha256: 'safe-contract' }, unsafeExecution: { receiptSha256: 'unsafe' } }, truthLedger: { unresolved: 7195 } },
    matrix: { requiredPassed: 157, requiredTotal: 157, status: 'pass', receiptSha256: 'matrix' },
  });
  assert.match(report, /157\/157/);
  assert.match(report, /general coding intelligence/i);
  assert.match(report, /NolaneNative function-level parity remains unverified/i);
});
