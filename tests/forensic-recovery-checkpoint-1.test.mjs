import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyForensicRecoveryCheckpoint1 } from '../src/forensics/recovery-checkpoint-1.mjs';
import { generateForensicRecoveryCheckpoint1 } from '../scripts/verify-forensic-recovery-checkpoint-1.mjs';

function validInput(overrides = {}) {
  return {
    custody: { records: [{ id: 'nolane-native-canonical', status: 'missing' }, { id: 'nolane-package-anchor', status: 'verified' }] },
    symbolInventory: { files: 700, parseFailures: 0, symbols: 6000, surfaces: 1000, inventorySha256: 'a'.repeat(64) },
    provisionalNolaneNative: { records: 8500, functionInventoryRecords: 0, canonicalSourceAvailable: false },
    truthLedger: { total: 8500, resolved: 1300, unresolved: 7200, completeParityEligible: false, byStatus: { 'upstream-source-unavailable': 7200 } },
    evidenceAudit: { certifiable: false, verifiedRequirements: 1300, violations: [{ code: 'missing-positive-assertion' }], overBroadEvidence: [] },
    verifier: { failClosed: true, status: 'pass', decisions: [{ pass: true }] },
    uiAudit: { complete: false, defaultUiVersion: 'v2', summary: { implemented: 6, partial: 8, missing: 4, externalCertification: 1 } },
    claims: { completeParityClaimAllowed: false, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false },
    ...overrides,
  };
}

test('checkpoint rejects missing inventory, parse failures, and fail-open verification', () => {
  assert.throws(() => verifyForensicRecoveryCheckpoint1(validInput({ symbolInventory: null })), /symbol inventory/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint1(validInput({ symbolInventory: { files: 1, symbols: 1, surfaces: 1, parseFailures: 1, inventorySha256: 'a'.repeat(64) } })), /parse failures/i);
  assert.throws(() => verifyForensicRecoveryCheckpoint1(validInput({ verifier: { failClosed: false, status: 'pass' } })), /fail-closed/i);
});

test('checkpoint rejects any unlocked protected claim', () => {
  assert.throws(() => verifyForensicRecoveryCheckpoint1(validInput({ claims: { completeParityClaimAllowed: true, comparativeSuperiorityClaimAllowed: false, windowsUiCertified: false, providerRealCertified: false } })), /protected claim/i);
});

test('checkpoint passes when local recovery infrastructure is complete and blockers remain explicit', () => {
  const result = verifyForensicRecoveryCheckpoint1(validInput());
  assert.equal(result.status, 'pass');
  assert.equal(result.localRecoveryInfrastructureVerified, true);
  assert.equal(result.fullNolaneNativeParityVerified, false);
  assert.equal(result.uiV3Complete, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});


test('checkpoint verifier can run without mutating committed checkpoint artifacts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-forensic-pure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requirements = path.join(root, 'requirements');
  const docs = path.join(root, 'docs', 'checkpoints');
  await mkdir(requirements, { recursive: true });
  await mkdir(docs, { recursive: true });
  for (const relative of [
    'forensic-source-custody.json',
    'nolane-symbol-surface-inventory-summary.json',
    'nolane-native-provisional-source-inventory-summary.json',
    'nolane-native-function-parity-summary.json',
    'nolane-native-function-parity-ledger.jsonl',
    'forensic-evidence-quality-audit.json',
    'ui-v3-master-plan-gap-registry.json',
  ]) await copyFile(path.join(process.cwd(), 'requirements', relative), path.join(requirements, relative));
  const jsonPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.json');
  const mdPath = path.join(docs, 'NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.md');
  await writeFile(jsonPath, '{"sentinel":true}\n');
  await writeFile(mdPath, '# sentinel\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'forensic@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Forensic Test'], { cwd: root });
  await writeFile(path.join(root, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', 'fixture'], { cwd: root });

  await generateForensicRecoveryCheckpoint1({ root, writeOutputs: false });

  assert.equal(await readFile(jsonPath, 'utf8'), '{"sentinel":true}\n');
  assert.equal(await readFile(mdPath, 'utf8'), '# sentinel\n');
});
