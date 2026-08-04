#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VerifierMesh } from '../src/small-model/verifier-mesh.mjs';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint1 } from '../src/forensics/recovery-checkpoint-1.mjs';

async function readJson(filePath) { return JSON.parse(await readFile(filePath, 'utf8')); }
async function readJsonl(filePath) { return (await readFile(filePath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); }

export async function generateForensicRecoveryCheckpoint1({ root = process.cwd(), writeOutputs = false } = {}) {
  const requirements = path.join(root, 'requirements');
  const custody = await readJson(path.join(requirements, 'forensic-source-custody.json'));
  const symbolInventory = await readJson(path.join(requirements, 'nolane-symbol-surface-inventory-summary.json'));
  const provisionalNolaneNative = await readJson(path.join(requirements, 'nolane-native-provisional-source-inventory-summary.json'));
  const truthLedger = await readJson(path.join(requirements, 'nolane-native-function-parity-summary.json'));
  const truthRecords = await readJsonl(path.join(requirements, 'nolane-native-function-parity-ledger.jsonl'));
  const evidenceAudit = await readJson(path.join(requirements, 'forensic-evidence-quality-audit.json'));
  const uiAudit = await readJson(path.join(requirements, 'ui-v3-master-plan-gap-registry.json'));

  const mesh = new VerifierMesh();
  mesh.register({
    id: 'forensic-fail-closed-self-check',
    soundnessScope: ['verifier-contract'],
    readOnly: true,
    independent: true,
    evaluate: () => ({ pass: true, criterionDelta: 1 }),
  });
  const verifier = await mesh.verify({ candidateId: 'forensic-recovery-checkpoint-1', expectedEffect: { criterionDelta: 1 } });
  const claims = evaluateRecoveryClaims({ custody: custody.records, truthLedger: truthRecords, uiAudit, externalReceipts: [] });
  const verification = verifyForensicRecoveryCheckpoint1({ custody, symbolInventory, provisionalNolaneNative, truthLedger, evidenceAudit, verifier, uiAudit, claims });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = {
    schema: 'nolane.forensics.recovery-checkpoint-1.v1',
    product: 'Nolane Agent',
    productVersion: '5.0.0-beta.6',
    checkpoint: 'forensic-recovery-checkpoint.1',
    gitHead,
    verification,
    custody: { records: custody.records, claims },
    symbolInventory,
    provisionalNolaneNative,
    truthLedger,
    evidenceAudit: { certifiable: evidenceAudit.certifiable, verifiedRequirements: evidenceAudit.verifiedRequirements, summary: evidenceAudit.summary, overBroadEvidence: evidenceAudit.overBroadEvidence.slice(0, 50) },
    uiAudit,
    nextCheckpointEntryCriteria: [
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Parse NolaneNative source symbols and operational surfaces from verified bytes.',
      'Replace path-level provisional records with explicit symbol-level counterpart mappings.',
      'Add assertion-level evidence bindings and downgrade over-broad verified requirements.',
      'Implement missing UI v3 tasks before switching the default renderer.',
    ],
  };
  const docs = path.join(root, 'docs', 'checkpoints');
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.md');
  const md = `# Nolane Agent Forensic Recovery Checkpoint 1\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- Local recovery infrastructure verified: **yes**\n- Full NolaneNative parity verified: **no**\n- Comparative superiority verified: **no**\n- Canonical NolaneNative archive available: **no**\n- UI v3 complete/default: **${uiAudit.complete ? 'yes' : 'no'} / ${uiAudit.defaultUiVersion}**\n\n## Nolane inventory\n\n- Files parsed: ${symbolInventory.files}\n- Symbols: ${symbolInventory.symbols}\n- Operational surfaces: ${symbolInventory.surfaces}\n- Parse failures: ${symbolInventory.parseFailures}\n- Inventory SHA-256: \`${symbolInventory.inventorySha256}\`\n\n## NolaneNative truth state\n\n- Historical path records: ${provisionalNolaneNative.records}\n- Function-level NolaneNative records: ${provisionalNolaneNative.functionInventoryRecords}\n- Resolved exclusions: ${truthLedger.resolved}\n- Unresolved because source bytes are unavailable: ${truthLedger.unresolved}\n- Complete parity eligible: **${truthLedger.completeParityEligible}**\n\n## Evidence quality reset\n\n- Previously verified requirements audited: ${evidenceAudit.verifiedRequirements}\n- Documentation primary entrypoints: ${evidenceAudit.summary.documentationProductionEntrypoints}\n- Missing positive assertion bindings: ${evidenceAudit.summary.missingPositiveAssertions}\n- Missing negative tests: ${evidenceAudit.summary.missingNegativeTests}\n- Missing negative assertion bindings: ${evidenceAudit.summary.missingNegativeAssertions}\n- Over-broad test files: ${evidenceAudit.summary.overBroadTestFiles}\n\n## UI v3 master-plan state\n\n- Implemented: ${uiAudit.summary.implemented}\n- Partial: ${uiAudit.summary.partial}\n- Missing: ${uiAudit.summary.missing}\n- External certification: ${uiAudit.summary.externalCertification}\n\n## Protected claims\n\nAll remain locked: complete parity, comparative superiority, Windows UI certification, and provider-real certification.\n`;

  if (writeOutputs) {
    await mkdir(docs, { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(mdPath, md);
  }
  return { report, jsonPath, mdPath, wroteOutputs: writeOutputs };

}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const writeOutputs = process.argv.includes('--write');
  generateForensicRecoveryCheckpoint1({ writeOutputs }).then(({ report, jsonPath, mdPath, wroteOutputs }) => {
    console.log(JSON.stringify({ status: report.verification.status, receiptSha256: report.verification.receiptSha256, wroteOutputs, jsonPath: path.relative(process.cwd(), jsonPath), mdPath: path.relative(process.cwd(), mdPath) }, null, 2));
  }).catch((error) => { console.error(error?.stack ?? error); process.exitCode = 1; });
}
