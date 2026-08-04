#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDeliveryManifest } from '../src/forensics/delivery-manifest.mjs';
const ROOT = process.cwd();
const OUTPUT = path.resolve(process.env.FORENSIC_OUTPUT_DIR || '/mnt/data');
const PREFIX = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.2';
const BASELINE = process.env.FORENSIC_BASELINE_COMMIT || '0b3227b01ac6195a4a1d8fb6efb7b421818e2193';
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const CHECKPOINT = path.join(ROOT, 'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-2.json');
const MATRIX_ROOT = path.join(ROOT, 'release/matrix-5.0.0-beta.6');
await mkdir(OUTPUT, { recursive: true });
const output = (suffix) => path.join(OUTPUT, `${PREFIX}-${suffix}`);
const suffixes = ['source.zip','change-set.patch','change-set.zip','release-evidence.zip','CHECKPOINT.md','CHECKPOINT.json','VERIFICATION-REPORT.md','full-release-matrix.md','full-release-matrix.json','assertion-evidence-baseline.json','ui-v3-source-release.json','delivery-manifest.json','SHA256SUMS.txt'];
for (const suffix of suffixes) await rm(output(suffix), { force: true, recursive: true });
const sourceZip = output('source.zip');
execFileSync('git', ['archive', '--format=zip', `--prefix=${PREFIX}-source/`, `--output=${sourceZip}`, HEAD], { cwd: ROOT, stdio: 'inherit' });
const patchPath = output('change-set.patch');
await writeFile(patchPath, execFileSync('git', ['diff', '--binary', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 }));
const temp = await mkdtemp(path.join(os.tmpdir(), 'nolane-forensic-cp2-'));
const changeDir = path.join(temp, `${PREFIX}-change-set`); const evidenceDir = path.join(temp, `${PREFIX}-release-evidence`);
await mkdir(changeDir, { recursive: true }); await mkdir(evidenceDir, { recursive: true });
await cp(patchPath, path.join(changeDir, `${PREFIX}-change-set.patch`));
await writeFile(path.join(changeDir, 'COMMITS.txt'), execFileSync('git', ['log', '--oneline', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'utf8' }));
await writeFile(path.join(changeDir, 'CHANGED-FILES.txt'), execFileSync('git', ['diff', '--name-status', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'utf8' }));
await cp(path.join(ROOT, 'docs/superpowers/plans/2026-08-02-forensic-recovery-checkpoint-2.md'), path.join(changeDir, 'IMPLEMENTATION-PLAN.md'));
execFileSync('zip', ['-q', '-r', output('change-set.zip'), path.basename(changeDir)], { cwd: temp });
const evidenceFiles = [
  'requirements/forensic-source-custody.json','requirements/nolane-symbol-surface-inventory-summary.json','requirements/nolane-symbol-surface-inventory.jsonl',
  'requirements/nolane-native-provisional-source-inventory-summary.json','requirements/nolane-native-provisional-source-inventory.jsonl','requirements/nolane-native-function-parity-summary.json','requirements/nolane-native-function-parity-ledger.jsonl',
  'requirements/forensic-evidence-quality-audit.json','requirements/ui-v3-master-plan-gap-registry.json','requirements/assertion-evidence-bindings.jsonl',
  'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json','docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.md',
  'docs/ui-v3/accessibility-source-audit.json','docs/ui-v3/visual-state-manifest.json','docs/ui-v3/ui-v3-source-release.json','docs/ui-v3/performance-baseline.json',
  'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-2.md','docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-2.json',
];
for (const relative of evidenceFiles) { const target = path.join(evidenceDir, relative); await mkdir(path.dirname(target), { recursive: true }); await cp(path.join(ROOT, relative), target); }
execFileSync('zip', ['-q', '-r', output('release-evidence.zip'), path.basename(evidenceDir)], { cwd: temp });
await cp(path.join(ROOT, 'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-2.md'), output('CHECKPOINT.md'));
await cp(CHECKPOINT, output('CHECKPOINT.json'));
await cp(path.join(MATRIX_ROOT, 'full-release-matrix.md'), output('full-release-matrix.md'));
await cp(path.join(MATRIX_ROOT, 'full-release-matrix.json'), output('full-release-matrix.json'));
await cp(path.join(ROOT, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json'), output('assertion-evidence-baseline.json'));
await cp(path.join(ROOT, 'docs/ui-v3/ui-v3-source-release.json'), output('ui-v3-source-release.json'));
const checkpoint = JSON.parse(await readFile(CHECKPOINT, 'utf8')); const matrix = JSON.parse(await readFile(path.join(MATRIX_ROOT, 'full-release-matrix.json'), 'utf8'));
const e = checkpoint.assertionEvidence.coverage.summary;
await writeFile(output('VERIFICATION-REPORT.md'), `# Nolane Agent Forensic Recovery Checkpoint 2 Verification Report\n\n- Delivery commit: \`${HEAD}\`\n- Recovered Checkpoint 1 baseline: \`${BASELINE}\`\n- Checkpoint status: **${checkpoint.verification.status}**\n- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**\n- Matrix receipt: \`${matrix.receiptSha256}\`\n- UI v3 source-local tasks: ${checkpoint.uiAudit.summary.implemented}/18\n- UI v3 beta default: ${checkpoint.uiAudit.defaultUiVersion}\n- Assertion-bound UI/Audit requirements: ${e.requirementsBound}/${e.requirementsTotal}\n- Assertion-unbound requirements: ${e.requirementsUnbound}\n- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}\n\n## Non-claims\n\nComplete NolaneNative parity, comparative superiority, provider-real certification, Windows 8 GB performance, NVDA/Narrator, high contrast, and screenshot certification remain unverified.\n`);
const artifactPaths = suffixes.filter((name) => !['delivery-manifest.json','SHA256SUMS.txt'].includes(name)).map((name) => path.basename(output(name)));
const manifest = await createDeliveryManifest({ root: OUTPUT, artifactPaths, checkpoint: 'forensic-recovery-checkpoint.2', gitHead: HEAD });
await writeFile(output('delivery-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const checksumTargets = [...artifactPaths, path.basename(output('delivery-manifest.json'))].sort();
const sums = checksumTargets.map((name) => { const record = manifest.artifacts.find((item) => item.path === name); const hash = record?.sha256 ?? execFileSync('sha256sum', [path.join(OUTPUT, name)], { encoding: 'utf8' }).split(/\s+/)[0]; return `${hash}  ${name}`; });
await writeFile(output('SHA256SUMS.txt'), `${sums.join('\n')}\n`);
for (const archive of [sourceZip, output('change-set.zip'), output('release-evidence.zip')]) execFileSync('unzip', ['-tq', archive], { stdio: 'inherit' });
execFileSync('sha256sum', ['-c', path.basename(output('SHA256SUMS.txt'))], { cwd: OUTPUT, stdio: 'inherit' });
await rm(temp, { recursive: true, force: true });
console.log(JSON.stringify({ prefix: PREFIX, outputDirectory: OUTPUT, gitHead: HEAD, baseline: BASELINE, artifacts: checksumTargets.length + 1 }, null, 2));
