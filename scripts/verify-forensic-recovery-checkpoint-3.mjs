#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint3 } from '../src/forensics/recovery-checkpoint-3.mjs';
import { verifyBootstrapToolRouter } from '../src/small-model/bootstrap-tool-router-training.mjs';

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function readJsonl(file) { const source = (await readFile(file, 'utf8')).trim(); return source ? source.split(/\r?\n/).map(JSON.parse) : []; }

export async function generateForensicRecoveryCheckpoint3({ root = process.cwd(), writeOutputs = false } = {}) {
  const requirements = path.join(root, 'requirements');
  const custody = await readJson(path.join(requirements, 'forensic-source-custody.json'));
  const symbolInventory = await readJson(path.join(requirements, 'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger = await readJson(path.join(requirements, 'nolane-native-function-parity-summary.json'));
  const truthRecords = await readJsonl(path.join(requirements, 'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline = await readJson(path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const masterAudit = await readJson(path.join(root, 'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json'));
  const modelArtifact = await readJson(path.join(root, 'models/tool-router/bootstrap-v1/model.json'));
  const benchmark = await readJson(path.join(root, 'models/tool-router/bootstrap-v1/benchmark.json'));
  const datasetReceipt = await readJson(path.join(root, 'models/tool-router/bootstrap-v1/dataset-receipt.json'));
  const modelVerification = await verifyBootstrapToolRouter({ root });
  const claims = evaluateRecoveryClaims({ custody: custody.records, truthLedger: truthRecords, uiAudit: { sourceLocalComplete: true, complete: false, summary: { externalCertification: 1 } }, externalReceipts: [] });
  const verification = verifyForensicRecoveryCheckpoint3({ custody, truthLedger, assertionBaseline, masterAudit, modelArtifact, benchmark, modelVerification, claims });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = Object.freeze({
    schema: 'nolane.forensics.recovery-checkpoint-3.v1', product: 'Nolane Agent', productVersion: '5.0.0-beta.6', checkpoint: 'forensic-recovery-checkpoint.3', gitHead,
    verification, custody: { records: custody.records, claims }, symbolInventory, truthLedger,
    assertionEvidence: { receiptSha256: assertionBaseline.receiptSha256, coverage: assertionBaseline.coverage },
    masterLedgerAssertionAudit: { receiptSha256: masterAudit.receiptSha256, summary: masterAudit.summary, certifiable: masterAudit.certifiable },
    boundedSpecialist: { artifactSha256: modelArtifact.artifactSha256, specialist: modelArtifact.specialist, labels: modelArtifact.model.labels, dimensions: modelArtifact.model.dimensions, training: modelArtifact.model.training, benchmark, datasetReceipt, verification: modelVerification },
    nextCheckpointEntryCriteria: [
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Replace the 621 assertion-unbound Master Ledger records with exact positive and negative evidence bindings without over-broad test reuse.',
      'Train additional bounded specialists from verified non-synthetic trajectories and run repository-disjoint held-out benchmarks.',
      'Run UI performance, NVDA/Narrator, high-contrast, zoom, and screenshot certification on Windows 11 x64 with 8 GB RAM.',
      'Run provider-real dogfood and same-budget comparative benchmark with independent receipts.',
    ],
  });
  const docs = path.join(root, 'docs/checkpoints');
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-3.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-3.md');
  const audit = masterAudit.summary; const evidence = assertionBaseline.coverage.summary;
  const md = `# Nolane Agent Forensic Recovery Checkpoint 3\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- UI/Audit assertion bindings: **${evidence.requirementsBound}/${evidence.requirementsTotal}**\n- Full Master Ledger assertion dispositions: **${audit.requirementsTotal}/${audit.requirementsTotal}**\n- Bounded specialist artifact trained: **yes**\n- General coding intelligence claim: **no**\n- NolaneNative function-level parity: **not verified**\n\n## Master Ledger assertion truth\n\n- Assertion-verified: ${audit.assertionVerified}\n- Assertion-unbound: ${audit.assertionUnbound}\n- External-unverified: ${audit.externalUnverified}\n- Over-broad test files: ${audit.overBroadTestFiles}\n- Missing negative assertions: ${audit.missingNegativeAssertions}\n- Audit receipt: \`${masterAudit.receiptSha256}\`\n\n## Bounded specialist model\n\n- Specialist: \`${modelArtifact.specialist}\`\n- Artifact: \`${modelArtifact.artifactSha256}\`\n- Labels: ${modelArtifact.model.labels.join(', ')}\n- Dimensions: ${modelArtifact.model.dimensions}\n- Train examples: ${modelArtifact.model.training.examples}\n- Initial/final loss: ${modelArtifact.model.training.lossHistory[0]} → ${modelArtifact.model.training.lossHistory.at(-1)}\n- Validation accuracy: ${benchmark.validation.accuracy}\n- Held-out accuracy: ${benchmark.heldOut.accuracy}\n- Benchmark receipt: \`${benchmark.receiptSha256}\`\n\n## Protected non-claims\n\nComplete NolaneNative parity, comparative superiority, small-model superintelligence, general coding intelligence, provider-real certification, and Windows external certification remain locked.\n`;
  if (writeOutputs) { await mkdir(docs, { recursive: true }); await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`); await writeFile(mdPath, md); }
  return Object.freeze({ report, jsonPath, mdPath, wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateForensicRecoveryCheckpoint3({ writeOutputs: process.argv.includes('--write') })
  .then(({ report, jsonPath, mdPath, wroteOutputs }) => console.log(JSON.stringify({ status: report.verification.status, receiptSha256: report.verification.receiptSha256, wroteOutputs, jsonPath: path.relative(process.cwd(), jsonPath), mdPath: path.relative(process.cwd(), mdPath) })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
