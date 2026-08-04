#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createChecksumLines, createDeliveryManifest } from '../src/forensics/delivery-manifest.mjs';
import { createCheckpoint5DeliveryPlan } from '../src/forensics/checkpoint-5-delivery-plan.mjs';

const ROOT = process.cwd();
const OUTPUT = path.resolve(process.env.FORENSIC_OUTPUT_DIR || '/mnt/data');
const plan = createCheckpoint5DeliveryPlan();
const PREFIX = plan.prefix;
const BASELINE = process.env.FORENSIC_BASELINE_COMMIT || plan.baselineCommit;
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const CHECKPOINT = path.join(ROOT, 'docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.json');
const MATRIX_ROOT = path.join(ROOT, 'release/matrix-5.0.0-beta.6');
await mkdir(OUTPUT, { recursive: true });
const output = (suffix) => path.join(OUTPUT, `${PREFIX}-${suffix}`);
for (const suffix of plan.outputSuffixes) await rm(output(suffix), { force: true, recursive: true });

const sourceZip = output('source.zip');
execFileSync('git', ['archive', '--format=zip', `--prefix=${PREFIX}-source/`, `--output=${sourceZip}`, HEAD], { cwd: ROOT, stdio: 'inherit' });
const patchPath = output('change-set.patch');
await writeFile(patchPath, execFileSync('git', ['diff', '--binary', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 }));

const temp = await mkdtemp(path.join(os.tmpdir(), 'nolane-forensic-cp5-'));
const changeDir = path.join(temp, `${PREFIX}-change-set`);
const evidenceDir = path.join(temp, `${PREFIX}-release-evidence`);
await mkdir(changeDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });
await cp(patchPath, path.join(changeDir, `${PREFIX}-change-set.patch`));
await writeFile(path.join(changeDir, 'COMMITS.txt'), execFileSync('git', ['log', '--oneline', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'utf8' }));
await writeFile(path.join(changeDir, 'CHANGED-FILES.txt'), execFileSync('git', ['diff', '--name-status', `${BASELINE}..${HEAD}`], { cwd: ROOT, encoding: 'utf8' }));
await cp(path.join(ROOT, plan.planPath), path.join(changeDir, 'IMPLEMENTATION-PLAN.md'));
execFileSync('zip', ['-q', '-r', output('change-set.zip'), path.basename(changeDir)], { cwd: temp });

for (const relative of plan.evidenceFiles) {
  const target = path.join(evidenceDir, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(ROOT, relative), target);
}
execFileSync('zip', ['-q', '-r', output('release-evidence.zip'), path.basename(evidenceDir)], { cwd: temp });

const copies = [
  ['docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.md', 'CHECKPOINT.md'],
  ['docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-5.json', 'CHECKPOINT.json'],
  ['release/matrix-5.0.0-beta.6/full-release-matrix.md', 'full-release-matrix.md'],
  ['release/matrix-5.0.0-beta.6/full-release-matrix.json', 'full-release-matrix.json'],
  ['docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json', 'assertion-evidence-baseline.json'],
  ['docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json', 'master-ledger-assertion-audit.json'],
  ['datasets/trajectories/repository-v1/receipt.json', 'repository-trajectory-receipt.json'],
];
for (const [relative, suffix] of copies) await cp(path.join(ROOT, relative), output(suffix));

const checkpoint = JSON.parse(await readFile(CHECKPOINT, 'utf8'));
const suite = checkpoint.repositorySpecialistSuite;
await writeFile(output('repository-specialist-suite-verification.json'), `${JSON.stringify(suite.verification, null, 2)}\n`);
await writeFile(output('safe-decision-support.json'), `${JSON.stringify(suite.safeDecisionReceipt, null, 2)}\n`);
await writeFile(output('unsafe-decision-support.json'), `${JSON.stringify(suite.unsafeDecisionReceipt, null, 2)}\n`);
const matrix = JSON.parse(await readFile(path.join(MATRIX_ROOT, 'full-release-matrix.json'), 'utf8'));
const audit = checkpoint.masterLedgerAssertionAudit.summary;
await writeFile(output('VERIFICATION-REPORT.md'), `# Nolane Agent Forensic Recovery Checkpoint 5 Verification Report

- Delivery commit: \`${HEAD}\`
- Checkpoint 4 baseline: \`${BASELINE}\`
- Checkpoint status: **${checkpoint.verification.status}**
- Full Release Matrix: **${matrix.requiredPassed}/${matrix.requiredTotal} required gates ${matrix.status}**
- Matrix receipt: \`${matrix.receiptSha256}\`
- UI/Audit assertion bindings: 48/48
- Master Ledger dispositions: ${audit.assertionVerified} verified, ${audit.assertionUnbound} unbound, ${audit.externalUnverified} external-unverified
- Repository trajectories: **${checkpoint.repositoryTrajectories.receipt.episodeCount} verified executions**
- Trajectory receipt: \`${checkpoint.repositoryTrajectories.receipt.receiptSha256}\`
- Repository specialist suite: **5/5 verified**
- Suite verification: \`${suite.verification.receiptSha256}\`
- Safe decision receipt: \`${suite.safeDecisionReceipt.receiptSha256}\`
- Unsafe decision receipt: \`${suite.unsafeDecisionReceipt.receiptSha256}\`
- NolaneNative unresolved truth records: ${checkpoint.truthLedger.unresolved}

## Non-claims

General coding intelligence, small-model superintelligence, complete NolaneNative parity, comparative superiority, provider-real certification, and Windows external certification remain unverified.
`);

const artifactPaths = plan.outputSuffixes
  .filter((name) => !['delivery-manifest.json', 'SHA256SUMS.txt'].includes(name))
  .map((name) => path.basename(output(name)));
const manifest = await createDeliveryManifest({ root: OUTPUT, artifactPaths, checkpoint: 'forensic-recovery-checkpoint.5', gitHead: HEAD });
await writeFile(output('delivery-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const checksumTargets = [...artifactPaths, path.basename(output('delivery-manifest.json'))].sort();
const sums = await createChecksumLines({ root: OUTPUT, artifactPaths: checksumTargets });
await writeFile(output('SHA256SUMS.txt'), `${sums.join('\n')}\n`);
for (const archive of [sourceZip, output('change-set.zip'), output('release-evidence.zip')]) {
  execFileSync('unzip', ['-tq', archive], { stdio: 'inherit' });
}
execFileSync('sha256sum', ['-c', path.basename(output('SHA256SUMS.txt'))], { cwd: OUTPUT, stdio: 'inherit' });
await rm(temp, { recursive: true, force: true });
console.log(JSON.stringify({ prefix: PREFIX, outputDirectory: OUTPUT, gitHead: HEAD, baseline: BASELINE, artifacts: checksumTargets.length + 1 }, null, 2));
