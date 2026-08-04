#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint9 } from '../src/forensics/recovery-checkpoint-9.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const readJsonl = async (file) => { const source = (await readFile(file, 'utf8')).trim(); return source ? source.split(/\r?\n/).map(JSON.parse) : []; };
function verifyPipeline(value) {
  const { receiptSha256, ...base } = value ?? {};
  if (!/^[a-f0-9]{64}$/.test(String(receiptSha256 ?? '')) || canonicalSha256(base) !== receiptSha256) throw new Error('Checkpoint 9 pipeline evidence receipt mismatch');
  if (value.schema !== 'nolane.small-model.checkpoint-9-pipeline-evidence.v1' || value.status !== 'verified') throw new Error('Checkpoint 9 pipeline evidence is invalid');
  return value;
}

export async function generateForensicRecoveryCheckpoint9({ root = process.cwd(), writeOutputs = false } = {}) {
  const requirements = path.join(root, 'requirements');
  const custody = await readJson(path.join(requirements, 'forensic-source-custody.json'));
  const symbolInventory = await readJson(path.join(requirements, 'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger = await readJson(path.join(requirements, 'nolane-native-function-parity-summary.json'));
  const truthRecords = await readJsonl(path.join(requirements, 'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline = await readJson(path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const masterAudit = await readJson(path.join(root, 'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json'));
  const pipeline = verifyPipeline(await readJson(path.join(root, 'models/checkpoint-9/pipeline-evidence.json')));
  const claims = evaluateRecoveryClaims({
    custody: custody.records,
    truthLedger: truthRecords,
    uiAudit: { sourceLocalComplete: true, defaultUiVersion: 'v3', complete: false, summary: { externalCertification: 1 } },
    externalReceipts: [],
  });
  const verification = verifyForensicRecoveryCheckpoint9({
    custody, truthLedger, assertionBaseline, masterAudit,
    portfolio: pipeline.portfolio,
    evidenceBundle: pipeline.evidenceBundle,
    promotion: pipeline.promotion,
    safeExecution: pipeline.safeExecution,
    unsafeExecution: pipeline.unsafeExecution,
    claims,
  });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = Object.freeze({
    schema: 'nolane.forensics.recovery-checkpoint-9.v1',
    product: 'Nolane Agent', productVersion: '5.0.0-beta.6', checkpoint: 'forensic-recovery-checkpoint.9', gitHead, verification,
    custody: { records: custody.records, claims }, symbolInventory, truthLedger,
    assertionEvidence: { receiptSha256: assertionBaseline.receiptSha256, coverage: assertionBaseline.coverage },
    masterLedgerAssertionAudit: { receiptSha256: masterAudit.receiptSha256, summary: masterAudit.summary, certifiable: masterAudit.certifiable },
    checkpoint9Pipeline: {
      portfolio: pipeline.portfolio,
      evidenceBundle: pipeline.evidenceBundle,
      promotion: pipeline.promotion,
      safeExecution: pipeline.safeExecution,
      unsafeExecution: pipeline.unsafeExecution,
      pipelineReceiptSha256: pipeline.receiptSha256,
    },
    nextCheckpointEntryCriteria: [
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Run multi-file refactor and property verification on independently supplied external repositories.',
      'Extend the module graph to TypeScript type space, re-export chains, namespace imports, and cross-language migrations.',
      'Run Windows 11 x64 8 GB, provider-real, accessibility, and independent comparative certification.',
    ],
  });
  const docs = path.join(root, 'docs/checkpoints');
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-9.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-9.md');
  const md = `# Nolane Agent Forensic Recovery Checkpoint 9\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- Local Master Ledger assertion evidence: **${masterAudit.summary.assertionVerified}/1372 verified, ${masterAudit.summary.assertionUnbound} unbound**\n- External-unverified: **${masterAudit.summary.externalUnverified}**\n- Mission portfolio: **${pipeline.portfolio.missions.length} missions**\n- Multi-file transfer: **verified on project-disjoint pack**\n- SMT property trials: **${pipeline.portfolio.smtProperties.trials}**\n- Datalog property trials: **${pipeline.portfolio.datalogProperties.trials}**\n- Promotion v5 skills: **1/1**\n- Safe/unsafe execution: **verified/blocked**\n- General coding intelligence claim: **no**\n- NolaneNative function-level parity: **not verified**\n\n## Protected non-claims\n\nComplete NolaneNative parity, comparative superiority, small-model superintelligence, general coding intelligence, external repository generalization, provider-real certification, and Windows external certification remain locked.\n`;
  if (writeOutputs) {
    await mkdir(docs, { recursive: true });
    await Promise.all([writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`), writeFile(mdPath, md)]);
  }
  return Object.freeze({ report, jsonPath, mdPath, wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateForensicRecoveryCheckpoint9({ writeOutputs: process.argv.includes('--write') })
  .then(({ report, jsonPath, mdPath, wroteOutputs }) => console.log(JSON.stringify({ status: report.verification.status, receiptSha256: report.verification.receiptSha256, wroteOutputs, jsonPath: path.relative(process.cwd(), jsonPath), mdPath: path.relative(process.cwd(), mdPath) })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
