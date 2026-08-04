#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDeliveryManifest } from '../src/forensics/delivery-manifest.mjs';

const ROOT = process.cwd();
const OUTPUT = path.resolve(process.env.FORENSIC_OUTPUT_DIR || '/mnt/data');
const PREFIX = 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.1';
const BASELINE = process.env.FORENSIC_BASELINE_COMMIT || 'fc937fd69134753ab823194a14ffb070948d7512';
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const CHECKPOINT = path.join(ROOT, 'docs', 'checkpoints', 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.json');
const MATRIX_ROOT = path.join(ROOT, 'release', 'matrix-5.0.0-beta.6');
await mkdir(OUTPUT, { recursive: true });

const output = (suffix) => path.join(OUTPUT, `${PREFIX}-${suffix}`);
const removeTargets = [
  'source.zip', 'change-set.patch', 'change-set.zip', 'release-evidence.zip',
  'CHECKPOINT.md', 'CHECKPOINT.json', 'VERIFICATION-REPORT.md',
  'full-release-matrix.md', 'full-release-matrix.json', 'delivery-manifest.json', 'SHA256SUMS.txt',
].map(output);
for (const target of removeTargets) await rm(target, { force: true, recursive: true });

const sourceZip = output('source.zip');
execFileSync('git', ['archive', '--format=zip', `--prefix=${PREFIX}-source/`, `--output=${sourceZip}`, HEAD], { cwd: ROOT, stdio: 'inherit' });

const patchPath = output('change-set.patch');
const patch = execFileSync('git', ['diff', '--binary', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
await writeFile(patchPath, patch);

const temp = await mkdtemp(path.join(os.tmpdir(), 'nolane-forensic-package-'));
const changeDir = path.join(temp, `${PREFIX}-change-set`);
const evidenceDir = path.join(temp, `${PREFIX}-release-evidence`);
await mkdir(changeDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });
await cp(patchPath, path.join(changeDir, `${PREFIX}-change-set.patch`));
await writeFile(path.join(changeDir, 'COMMITS.txt'), execFileSync('git', ['log', '--oneline', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'utf8' }));
await writeFile(path.join(changeDir, 'CHANGED-FILES.txt'), execFileSync('git', ['diff', '--name-status', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'utf8' }));
await cp(path.join(ROOT, 'docs', 'superpowers', 'plans', '2026-08-02-forensic-recovery-checkpoint-1.md'), path.join(changeDir, 'IMPLEMENTATION-PLAN.md'));
await cp(path.join(ROOT, 'docs', 'superpowers', 'specs', '2026-08-02-forensic-recovery-checkpoint-1-design.md'), path.join(changeDir, 'DESIGN.md'));
execFileSync('zip', ['-q', '-r', output('change-set.zip'), path.basename(changeDir)], { cwd: temp });

const evidenceFiles = [
  'requirements/forensic-source-custody.json',
  'requirements/archive-decomposition/nolane-source.json',
  'requirements/nolane-symbol-surface-inventory-summary.json',
  'requirements/nolane-symbol-surface-inventory.jsonl',
  'requirements/nolane-native-provisional-source-inventory-summary.json',
  'requirements/nolane-native-provisional-source-inventory.jsonl',
  'requirements/nolane-native-function-parity-summary.json',
  'requirements/nolane-native-function-parity-ledger.jsonl',
  'requirements/forensic-evidence-quality-audit.json',
  'requirements/ui-v3-master-plan-gap-registry.json',
  'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.md',
  'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.json',
];
for (const relativePath of evidenceFiles) {
  const target = path.join(evidenceDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(ROOT, relativePath), target);
}
execFileSync('zip', ['-q', '-r', output('release-evidence.zip'), path.basename(evidenceDir)], { cwd: temp });

await cp(path.join(ROOT, 'docs', 'checkpoints', 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.md'), output('CHECKPOINT.md'));
await cp(CHECKPOINT, output('CHECKPOINT.json'));
await cp(path.join(MATRIX_ROOT, 'full-release-matrix.md'), output('full-release-matrix.md'));
await cp(path.join(MATRIX_ROOT, 'full-release-matrix.json'), output('full-release-matrix.json'));
const checkpoint = JSON.parse(await readFile(CHECKPOINT, 'utf8'));
const matrix = JSON.parse(await readFile(path.join(MATRIX_ROOT, 'full-release-matrix.json'), 'utf8'));
const report = `# Nolane Agent Forensic Recovery Checkpoint 1 Verification Report\n\n- Delivery commit: \`${HEAD}\`\n- Baseline commit: \`${BASELINE}\`\n- Checkpoint status: **${checkpoint.verification.status}**\n- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**\n- Matrix receipt: \`${matrix.receiptSha256}\`\n- Symbol files: ${checkpoint.symbolInventory.files}\n- Symbols: ${checkpoint.symbolInventory.symbols}\n- Operational surfaces: ${checkpoint.symbolInventory.surfaces}\n- Parse failures: ${checkpoint.symbolInventory.parseFailures}\n- NolaneNative historical path records: ${checkpoint.provisionalNolaneNative.records}\n- NolaneNative function records from canonical bytes: ${checkpoint.provisionalNolaneNative.functionInventoryRecords}\n- Unresolved truth records: ${checkpoint.truthLedger.unresolved}\n- UI v3: ${checkpoint.uiAudit.summary.implemented} implemented, ${checkpoint.uiAudit.summary.partial} partial, ${checkpoint.uiAudit.summary.missing} missing, default ${checkpoint.uiAudit.defaultUiVersion}\n\n## Non-claims\n\n- Complete NolaneNative parity: **not verified**\n- Comparative superiority: **not verified**\n- Windows UI certification: **not verified**\n- Provider-real certification: **not verified**\n\nThis checkpoint certifies the recovery/audit infrastructure and the fail-closed correction. It does not certify unavailable upstream behavior.\n`;
await writeFile(output('VERIFICATION-REPORT.md'), report);

const artifactPaths = removeTargets
  .filter((target) => !target.endsWith('delivery-manifest.json') && !target.endsWith('SHA256SUMS.txt'))
  .map((target) => path.basename(target));
const manifest = await createDeliveryManifest({ root: OUTPUT, artifactPaths, checkpoint: 'forensic-recovery-checkpoint.1', gitHead: HEAD });
await writeFile(output('delivery-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const checksumTargets = [...artifactPaths, path.basename(output('delivery-manifest.json'))].sort();
const sums = checksumTargets.map((name) => {
  const record = manifest.artifacts.find((item) => item.path === name);
  if (record) return `${record.sha256}  ${name}`;
  const hash = execFileSync('sha256sum', [path.join(OUTPUT, name)], { encoding: 'utf8' }).split(/\s+/)[0];
  return `${hash}  ${name}`;
});
await writeFile(output('SHA256SUMS.txt'), `${sums.join('\n')}\n`);

for (const archive of [sourceZip, output('change-set.zip'), output('release-evidence.zip')]) execFileSync('unzip', ['-tq', archive], { stdio: 'inherit' });
execFileSync('sha256sum', ['-c', path.basename(output('SHA256SUMS.txt'))], { cwd: OUTPUT, stdio: 'inherit' });
await rm(temp, { recursive: true, force: true });
console.log(JSON.stringify({ prefix: PREFIX, outputDirectory: OUTPUT, gitHead: HEAD, artifacts: checksumTargets.length + 1 }, null, 2));
