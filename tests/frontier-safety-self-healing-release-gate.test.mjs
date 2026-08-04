import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function exists(relative) {
  try { await access(path.resolve(relative)); return true; } catch { return false; }
}

test('3.0 release gate proves cross-repository safety and bounded self-healing without autonomous promotion', async (t) => {
  for (const relative of [
    'src/release/frontier-safety-self-healing-verifier.mjs',
    'scripts/verify-frontier-safety-self-healing.mjs',
    'scripts/measure-frontier-governance.mjs',
    'docs/frontier-governance-measurement-3.0.0.json',
    'docs/feature-audit-3.0.0.json',
    'docs/LIMITATIONS-3.0.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'frontier-safety-and-self-healing'/);
  const audit = JSON.parse(await readFile('docs/feature-audit-3.0.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 959, partial: 115, external_gate: 63, not_implemented: 13 });

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-300-frontier-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyFrontierSafetySelfHealing } = await import('../src/release/frontier-safety-self-healing-verifier.mjs');
  const report = await verifyFrontierSafetySelfHealing({
    rootDirectory: path.resolve('.'),
    version: '3.0.0',
    outputFile: path.join(output, 'frontier.json'),
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.measurement.workspace.crossRepositoryGraphBuilt, true);
  assert.equal(report.measurement.transaction.transactional, true);
  assert.equal(report.measurement.transaction.allOrRollback, true);
  assert.equal(report.measurement.commitChain.humanMergeGateRequired, true);
  assert.equal(report.measurement.postMerge.allFiveSignalKindsObserved, true);
  assert.equal(report.measurement.postMerge.directAttributionRequired, true);
  assert.equal(report.measurement.selfHealing.cleanBaselineBeforeWorktree, true);
  assert.equal(report.measurement.selfHealing.regressionTestRequired, true);
  assert.equal(report.measurement.selfHealing.autonomousMergeAllowed, false);
  assert.equal(report.measurement.survival.shadowOnly, true);
  assert.equal(report.measurement.lineage.exactVersionLineage, true);
  assert.equal(report.measurement.constitution.forbiddenMutationBlocked, true);
  assert.equal(report.measurement.constitution.humanApprovalRequired, true);
  assert.equal(report.measurement.constitution.productionPromotionExecuted, false);
  assert.equal(report.measurement.comparability.sameCriteriaAndEnvironment, true);
  assert.equal(report.measurement.semanticMerge.behavioralConflictDetected, true);
  assert.equal(report.measurement.boundaries.frontierSuperiorityClaimAllowed, false);
});
