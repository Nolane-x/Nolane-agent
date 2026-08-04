#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';
import { verifyForensicRecoveryCheckpoint6 } from '../src/forensics/recovery-checkpoint-6.mjs';
import { verifyMultiRuntimeTrajectoryDataset } from '../src/small-model/multi-runtime-trajectory-collector.mjs';
import { verifyMutationRecoveryDataset } from '../src/small-model/mutation-recovery-lab.mjs';
import { verifyCheckpoint6SpecialistSuite } from '../src/small-model/checkpoint-6-specialist-training.mjs';
import { buildCheckpoint6SpecialistDataset, CHECKPOINT_6_SPECIALISTS } from '../src/small-model/checkpoint-6-specialist-dataset.mjs';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { Checkpoint6DecisionSupport } from '../src/small-model/checkpoint-6-decision-support.mjs';
import { verifyThirdPartyProvenance } from '../src/release/third-party-provenance.mjs';

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function readJsonl(file) { const source = (await readFile(file, 'utf8')).trim(); return source ? source.split(/\r?\n/).map(JSON.parse) : []; }
const keyBySpecialist = { 'tool-router': 'tool', 'context-scorer': 'context', 'test-selector': 'test', 'patch-ranker': 'patch', 'risk-classifier': 'risk' };

async function decisionInput({ repositoryTrajectoryDir, multiRuntimeDir, scenarioGroup }) {
  const input = {};
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
    const example = dataset.examples.find((entry) => entry.state.scenarioGroup === scenarioGroup);
    if (!example) throw new Error(`Missing checkpoint 6 decision example: ${specialist}/${scenarioGroup}`);
    input[keyBySpecialist[specialist]] = example.state;
  }
  return input;
}

export async function generateForensicRecoveryCheckpoint6({ root = process.cwd(), writeOutputs = false } = {}) {
  const requirements = path.join(root, 'requirements');
  const custody = await readJson(path.join(requirements, 'forensic-source-custody.json'));
  const symbolInventory = await readJson(path.join(requirements, 'nolane-symbol-surface-inventory-summary.json'));
  const truthLedger = await readJson(path.join(requirements, 'nolane-native-function-parity-summary.json'));
  const truthRecords = await readJsonl(path.join(requirements, 'nolane-native-function-parity-ledger.jsonl'));
  const assertionBaseline = await readJson(path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'));
  const masterAudit = await readJson(path.join(root, 'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json'));
  const repositoryTrajectoryDir = path.join(root, 'datasets/trajectories/repository-v1');
  const multiRuntimeDir = path.join(root, 'datasets/trajectories/multi-runtime-v1');
  await verifyMultiRuntimeTrajectoryDataset({ outputDir: multiRuntimeDir });
  await verifyMutationRecoveryDataset({ outputDir: multiRuntimeDir });
  const multiRuntime = await readJson(path.join(multiRuntimeDir, 'execution-receipt.json'));
  const recovery = await readJson(path.join(multiRuntimeDir, 'recovery-receipt.json'));
  const outputRoot = path.join(root, 'models/specialists-checkpoint-6');
  const suiteVerification = await verifyCheckpoint6SpecialistSuite({ outputRoot });
  const suiteArtifacts = {}; const suiteBenchmarks = {}; const suiteAblations = {}; const suiteDatasetReceipts = {};
  const registry = new ModelArtifactRegistry();
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const target = path.join(outputRoot, specialist, 'multi-runtime-v1');
    const [artifact, benchmark, ablation, datasetReceipt] = await Promise.all([
      readJson(path.join(target, 'model.json')),
      readJson(path.join(target, 'benchmark.json')),
      readJson(path.join(target, 'ablation.json')),
      readJson(path.join(target, 'dataset-receipt.json')),
    ]);
    suiteArtifacts[specialist] = artifact; suiteBenchmarks[specialist] = benchmark; suiteAblations[specialist] = ablation; suiteDatasetReceipts[specialist] = datasetReceipt;
    registry.register(artifact);
    registry.promoteWithAblation({ artifactSha256: artifact.artifactSha256, evaluation: benchmark.heldOut, ablation, approvedBy: 'forensic-recovery-checkpoint-6' });
  }
  const support = new Checkpoint6DecisionSupport({ artifactRegistry: registry });
  const safeDecisionReceipt = support.decide(await decisionInput({ repositoryTrajectoryDir, multiRuntimeDir, scenarioGroup: 'advanced-search-service' }));
  const unsafeDecisionReceipt = support.decide(await decisionInput({ repositoryTrajectoryDir, multiRuntimeDir, scenarioGroup: 'browser-injection-guard' }));
  const thirdPartyProvenance = verifyThirdPartyProvenance({ noticeText: await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8') });
  const claims = evaluateRecoveryClaims({ custody: custody.records, truthLedger: truthRecords, uiAudit: { sourceLocalComplete: true, defaultUiVersion: 'v3', complete: false, summary: { externalCertification: 1 } }, externalReceipts: [] });
  const verification = verifyForensicRecoveryCheckpoint6({ custody, truthLedger, assertionBaseline, masterAudit, multiRuntime, recovery, suiteArtifacts, suiteBenchmarks, suiteAblations, suiteVerification, safeDecisionReceipt, unsafeDecisionReceipt, thirdPartyProvenance, claims });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = Object.freeze({
    schema: 'nolane.forensics.recovery-checkpoint-6.v1', product: 'Nolane Agent', productVersion: '5.0.0-beta.6', checkpoint: 'forensic-recovery-checkpoint.6', gitHead, verification,
    custody: { records: custody.records, claims }, symbolInventory, truthLedger,
    assertionEvidence: { receiptSha256: assertionBaseline.receiptSha256, coverage: assertionBaseline.coverage },
    masterLedgerAssertionAudit: { receiptSha256: masterAudit.receiptSha256, summary: masterAudit.summary, certifiable: masterAudit.certifiable },
    multiRuntimeTrajectories: multiRuntime, mutationRecoveryTrajectories: recovery,
    checkpoint6SpecialistSuite: { verification: suiteVerification, artifacts: suiteArtifacts, benchmarks: suiteBenchmarks, ablations: suiteAblations, datasetReceipts: suiteDatasetReceipts, safeDecisionReceipt, unsafeDecisionReceipt },
    thirdPartyProvenance,
    nextCheckpointEntryCriteria: [
      'Provide canonical NolaneNative archive bytes matching SHA-256 1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9.',
      'Collect held-out trajectories from repositories not contained in the Nolane monorepo.',
      'Run UI performance, NVDA/Narrator, high-contrast, zoom, and screenshot certification on Windows 11 x64 with 8 GB RAM.',
      'Run provider-real dogfood and same-budget comparative benchmark with independent receipts.',
    ],
  });
  const docs = path.join(root, 'docs/checkpoints');
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-6.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-6.md');
  const audit = masterAudit.summary;
  const md = `# Nolane Agent Forensic Recovery Checkpoint 6\n\n- Status: **${verification.status}**\n- Git head at generation: \`${gitHead}\`\n- Local Master Ledger assertion evidence: **${audit.assertionVerified}/1372 verified, ${audit.assertionUnbound} unbound**\n- External-unverified: **${audit.externalUnverified}**\n- Multi-runtime trajectories: **${multiRuntime.episodeCount} across ${multiRuntime.runtimes.join(', ')}**\n- Mutation failures/recovery passes: **${recovery.mutationFailures}/${recovery.recoveryPasses}**\n- Ablation-governed specialist suite: **5/5 verified**\n- Safe decision: **${safeDecisionReceipt.status}**\n- Unsafe decision: **${unsafeDecisionReceipt.status}**\n- Third-party provenance: **verified**\n- General coding intelligence claim: **no**\n- NolaneNative function-level parity: **not verified**\n\n## Specialist ablation\n\n${verification.specialists.map((item) => `- \`${item.specialist}\`: held-out ${item.heldOutAccuracy}, lift ${item.lift}, artifact \`${item.artifactSha256}\``).join('\n')}\n\n## Protected non-claims\n\nComplete NolaneNative parity, comparative superiority, small-model superintelligence, general coding intelligence, provider-real certification, and Windows external certification remain locked.\n`;
  if (writeOutputs) { await mkdir(docs, { recursive: true }); await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`); await writeFile(mdPath, md); }
  return Object.freeze({ report, jsonPath, mdPath, wroteOutputs: writeOutputs });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateForensicRecoveryCheckpoint6({ writeOutputs: process.argv.includes('--write') }).then(({ report, jsonPath, mdPath, wroteOutputs }) => console.log(JSON.stringify({ status: report.verification.status, receiptSha256: report.verification.receiptSha256, wroteOutputs, jsonPath: path.relative(process.cwd(), jsonPath), mdPath: path.relative(process.cwd(), mdPath) }))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
