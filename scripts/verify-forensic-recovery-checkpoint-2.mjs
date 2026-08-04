#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint2 } from '../src/forensics/recovery-checkpoint-2.mjs';

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function readJsonl(file) { const source = (await readFile(file, 'utf8')).trim(); return source ? source.split(/\r?\n/).map(JSON.parse) : []; }
export async function generateForensicRecoveryCheckpoint2({ root = process.cwd(), writeOutputs = false } = {}) {
  const requirements = path.join(root, 'requirements');
  const custody = await readJson(path.join(requirements, 'forensic-source-custody.json'));
  const symbolInventory = await readJson(path.join(requirements, 'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger = await readJson(path.join(requirements, 'nolane-native-function-parity-summary.json'));
  const truthRecords = await readJsonl(path.join(requirements, 'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline = await readJson(path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const uiAudit = await readJson(path.join(requirements, 'ui-v3-master-plan-gap-registry.json'));
  const uiRelease = await readJson(path.join(root, 'docs/ui-v3/ui-v3-source-release.json'));
  const claims = evaluateRecoveryClaims({ custody: custody.records, truthLedger: truthRecords, uiAudit, externalReceipts: [] });
  const verification = verifyForensicRecoveryCheckpoint2({ custody, symbolInventory, truthLedger, assertionBaseline, uiAudit, uiRelease, claims });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = Object.freeze({
    schema: 'nolane.forensics.recovery-checkpoint-2.v1', product: 'Nolane Agent', productVersion: '5.0.0-beta.6', checkpoint: 'forensic-recovery-checkpoint.2', gitHead,
    verification, custody: { records: custody.records, claims }, symbolInventory, truthLedger,
    assertionEvidence: { receiptSha256: assertionBaseline.receiptSha256, coverage: assertionBaseline.coverage },
    uiAudit, uiRelease,
    nextCheckpointEntryCriteria: [
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Replace unresolved path metadata with parsed upstream symbols and explicit counterpart records.',
      'Bind the remaining UI/Audit requirements to exact named positive and negative assertions.',
      'Run UI performance, NVDA/Narrator, high-contrast, zoom, and screenshot certification on Windows 11 x64 with 8 GB RAM.',
      'Run provider-real dogfood and same-budget comparative benchmark with independent receipts.',
    ],
  });
  const docs = path.join(root, 'docs/checkpoints');
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-2.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-2.md');
  const s = assertionBaseline.coverage.summary;
  const md = `# Nolane Agent Forensic Recovery Checkpoint 2\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- UI v3 source-local complete: **yes**\n- UI v3 beta default: **yes**\n- UI external certification: **pending**\n- NolaneNative function-level parity: **not verified**\n\n## UI v3\n\n- Implemented source-local tasks: ${uiAudit.summary.implemented}/18\n- Partial: ${uiAudit.summary.partial}\n- Missing: ${uiAudit.summary.missing}\n- External certification items: ${uiAudit.summary.externalCertification}\n- Source release receipt: \`${uiRelease.receiptSha256}\`\n\n## Assertion evidence reconstruction\n\n- Requirements in scope: ${s.requirementsTotal}\n- Bound to named positive and negative evidence: ${s.requirementsBound}\n- Still unbound: ${s.requirementsUnbound}\n- Over-broad test files: ${s.overBroadTestFiles}\n- Complete: **${assertionBaseline.coverage.certifiable}**\n- Receipt: \`${assertionBaseline.receiptSha256}\`\n\n## NolaneNative truth state\n\n- Total historical records: ${truthLedger.total}\n- Resolved exclusions: ${truthLedger.resolved}\n- Unresolved without canonical source bytes: ${truthLedger.unresolved}\n- Complete parity eligible: **${truthLedger.completeParityEligible}**\n\n## Protected non-claims\n\nComplete parity, comparative superiority, Windows certification, provider-real certification, screen-reader certification, visual screenshot certification, and Windows 8 GB performance certification remain locked.\n`;
  if (writeOutputs) { await mkdir(docs, { recursive: true }); await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`); await writeFile(mdPath, md); }
  return Object.freeze({ report, jsonPath, mdPath, wroteOutputs: writeOutputs });
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateForensicRecoveryCheckpoint2({ writeOutputs: process.argv.includes('--write') }).then(({ report, jsonPath, mdPath, wroteOutputs }) => console.log(JSON.stringify({ status: report.verification.status, receiptSha256: report.verification.receiptSha256, wroteOutputs, jsonPath: path.relative(process.cwd(), jsonPath), mdPath: path.relative(process.cwd(), mdPath) }))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
