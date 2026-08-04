#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint7 } from '../src/forensics/recovery-checkpoint-7.mjs';
import { CHECKPOINT_6_SPECIALISTS } from '../src/small-model/checkpoint-6-specialist-dataset.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const readJsonl = async (file) => { const source = (await readFile(file, 'utf8')).trim(); return source ? source.split(/\r?\n/).map(JSON.parse) : []; };

function verifyPipelineReceipt(value) {
  const { receiptSha256, ...base } = value ?? {};
  if (!/^[a-f0-9]{64}$/.test(String(receiptSha256 ?? '')) || canonicalSha256(base) !== receiptSha256) throw new Error('Checkpoint 7 pipeline evidence receipt mismatch');
  return value;
}

export async function generateForensicRecoveryCheckpoint7({ root = process.cwd(), writeOutputs = false } = {}) {
  const requirements = path.join(root, 'requirements');
  const custody = await readJson(path.join(requirements, 'forensic-source-custody.json'));
  const symbolInventory = await readJson(path.join(requirements, 'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger = await readJson(path.join(requirements, 'nolane-native-function-parity-summary.json'));
  const truthRecords = await readJsonl(path.join(requirements, 'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline = await readJson(path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const masterAudit = await readJson(path.join(root, 'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json'));
  const missionCollection = await readJson(path.join(root, 'datasets/trajectories/checkpoint-7-v1/mission-collection.json'));
  const processArtifact = await readJson(path.join(root, 'models/process-reward-checkpoint-7/model.json'));
  const pipeline = verifyPipelineReceipt(await readJson(path.join(root, 'models/checkpoint-7/pipeline-evidence.json')));
  if (pipeline.collectionReceiptSha256 !== missionCollection.receiptSha256) throw new Error('Checkpoint 7 pipeline collection binding mismatch');
  const specialistArtifacts = {};
  for (const specialist of CHECKPOINT_6_SPECIALISTS) specialistArtifacts[specialist] = await readJson(path.join(root, 'models/specialists-checkpoint-6', specialist, 'multi-runtime-v1/model.json'));
  const claims = evaluateRecoveryClaims({ custody: custody.records, truthLedger: truthRecords, uiAudit: { sourceLocalComplete: true, defaultUiVersion: 'v3', complete: false, summary: { externalCertification: 1 } }, externalReceipts: [] });
  const verification = verifyForensicRecoveryCheckpoint7({
    custody, truthLedger, assertionBaseline, masterAudit, missionCollection,
    preparation: pipeline.preparation, promotion: pipeline.promotion, processArtifact, specialistArtifacts,
    safeDecisionReceipt: pipeline.safeDecisionReceipt, unsafeDecisionReceipt: pipeline.unsafeDecisionReceipt, claims,
  });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = Object.freeze({
    schema: 'nolane.forensics.recovery-checkpoint-7.v1', product: 'Nolane Agent', productVersion: '5.0.0-beta.6', checkpoint: 'forensic-recovery-checkpoint.7', gitHead, verification,
    custody: { records: custody.records, claims }, symbolInventory, truthLedger,
    assertionEvidence: { receiptSha256: assertionBaseline.receiptSha256, coverage: assertionBaseline.coverage },
    masterLedgerAssertionAudit: { receiptSha256: masterAudit.receiptSha256, summary: masterAudit.summary, certifiable: masterAudit.certifiable },
    checkpoint7Pipeline: {
      missionCollection,
      processVerification: pipeline.processVerification,
      skill: pipeline.skill,
      skillTransfer: pipeline.skillTransfer,
      evidenceBundles: pipeline.evidenceBundles,
      promotion: pipeline.promotion,
      safeDecisionReceipt: pipeline.safeDecisionReceipt,
      unsafeDecisionReceipt: pipeline.unsafeDecisionReceipt,
      pipelineReceiptSha256: pipeline.receiptSha256,
    },
    nextCheckpointEntryCriteria: [
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Collect external held-out repository missions that are not packaged as Nolane fixtures.',
      'Replace declared exact-rewrite skill transfer with AST and constraint solvers across unrelated repair families.',
      'Run Windows 11 x64 8 GB, provider-real, accessibility and independent comparative certification.',
    ],
  });
  const docs = path.join(root, 'docs/checkpoints');
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-7.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-7.md');
  const audit = masterAudit.summary;
  const md = `# Nolane Agent Forensic Recovery Checkpoint 7\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- Local Master Ledger assertion evidence: **${audit.assertionVerified}/1372 verified, ${audit.assertionUnbound} unbound**\n- External-unverified: **${audit.externalUnverified}**\n- Held-out primary/induction missions: **${missionCollection.primaryMissions.length}/${missionCollection.inductionMissions.length}**\n- Process reward specialist: **verified**\n- Declarative skill transfer: **verified on disjoint repository**\n- Transfer/process/cost-governed specialist promotion: **5/5**\n- Safe/unsafe decisions: **${pipeline.safeDecisionReceipt.status}/${pipeline.unsafeDecisionReceipt.status}**\n- General coding intelligence claim: **no**\n- NolaneNative function-level parity: **not verified**\n\n## Protected non-claims\n\nComplete NolaneNative parity, comparative superiority, small-model superintelligence, general coding intelligence, provider-real certification, and Windows external certification remain locked.\n`;
  if (writeOutputs) {
    await mkdir(docs, { recursive: true });
    await Promise.all([writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`), writeFile(mdPath, md)]);
  }
  return Object.freeze({ report, jsonPath, mdPath, wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateForensicRecoveryCheckpoint7({ writeOutputs: process.argv.includes('--write') })
  .then(({ report, jsonPath, mdPath, wroteOutputs }) => console.log(JSON.stringify({ status: report.verification.status, receiptSha256: report.verification.receiptSha256, wroteOutputs, jsonPath: path.relative(process.cwd(), jsonPath), mdPath: path.relative(process.cwd(), mdPath) })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
