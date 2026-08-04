import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) {
  try { await access(path.resolve(relative)); return true; }
  catch { return false; }
}

test('2.24 release gate proves executable long-horizon construction without autonomous mutation claims', async (t) => {
  for (const relative of [
    'src/release/long-horizon-construction-verifier.mjs',
    'scripts/verify-long-horizon-construction.mjs',
    'scripts/measure-long-horizon-construction.mjs',
    'docs/long-horizon-construction-measurement-2.24.0.json',
    'docs/feature-audit-2.24.0.json',
    'docs/LIMITATIONS-2.24.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'long-horizon-construction'/);

  const audit = JSON.parse(await readFile('docs/feature-audit-2.24.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, {
    verified_source_test: 805,
    partial: 54,
    external_gate: 56,
    not_implemented: 235,
  });

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-224-construction-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyLongHorizonConstruction } = await import('../src/release/long-horizon-construction-verifier.mjs');
  const report = await verifyLongHorizonConstruction({
    rootDirectory: path.resolve('.'),
    version: '2.24.0',
    outputFile: path.join(output, 'report.json'),
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.measurement.specification.conflictBlocked, true);
  assert.equal(report.measurement.traceability.criterionCompleted, true);
  assert.equal(report.measurement.invariants.staleBlocks, true);
  assert.equal(report.measurement.plan.repositoryDriftBlocks, true);
  assert.equal(report.measurement.capsule.exactResume, true);
  assert.equal(report.measurement.capsule.driftRequiresRevalidation, true);
  assert.equal(report.measurement.obligation.completedAfterTrigger, true);
  assert.equal(report.measurement.patch.safePatchAllowed, true);
  assert.equal(report.measurement.patch.publicApiBreakBlocked, true);
  assert.equal(report.measurement.candidates.correctnessFirst, true);
  assert.equal(report.measurement.candidates.semanticFootprintSelected, true);
  assert.equal(report.measurement.proof.completeWithReceipts, true);
  assert.equal(report.measurement.proof.incompleteWithoutReceipts, true);
  assert.equal(report.boundaries.directFileMutationClaimed, false);
  assert.equal(report.boundaries.worktreeCreationClaimed, false);
  assert.equal(report.boundaries.crossRebootProductionCertified, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
