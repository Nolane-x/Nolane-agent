import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.26 release gate proves governed memory, transferable skills, and utility-based resource admission', async (t) => {
  for (const relative of [
    'src/release/memory-skill-resource-os-verifier.mjs',
    'scripts/verify-memory-skill-resource-os.mjs',
    'scripts/measure-memory-skill-resource-os.mjs',
    'docs/memory-skill-resource-os-measurement-2.26.0.json',
    'docs/feature-audit-2.26.0.json',
    'docs/LIMITATIONS-2.26.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'memory-skill-os'/);
  assert.match(matrix, /id: 'resource-admission-control'/);

  const audit = JSON.parse(await readFile('docs/feature-audit-2.26.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 854, partial: 77, external_gate: 56, not_implemented: 163 });

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-226-memory-resource-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyMemorySkillResourceOs } = await import('../src/release/memory-skill-resource-os-verifier.mjs');
  const report = await verifyMemorySkillResourceOs({ rootDirectory: path.resolve('.'), version: '2.26.0', outputFile: path.join(output, 'report.json') });

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.measurement.memory.operations, ['abstract', 'archive', 'delete', 'deprioritize', 'invalidate', 'suppress']);
  assert.equal(report.measurement.memory.versionHistory, true);
  assert.equal(report.measurement.memory.exceptionPrecedence, true);
  assert.equal(report.measurement.policy.selfReportRejected, true);
  assert.equal(report.measurement.policy.verifiedConsolidationAllowed, true);
  assert.equal(report.measurement.replay.modelTimeIgnoresRawSteps, true);
  assert.equal(report.measurement.replay.revertedEpisodePrioritized, true);
  assert.equal(report.measurement.skills.typedOperator, true);
  assert.equal(report.measurement.skills.transferRequired, true);
  assert.equal(report.measurement.skills.regressionBlocked, true);
  assert.equal(report.measurement.resources.lowValueBrowserDenied, true);
  assert.equal(report.measurement.resources.targetedTestAdmitted, true);
  assert.equal(report.measurement.resources.rssMbSecondsMeasured, true);
  assert.equal(report.measurement.resources.predictedEviction, true);
  assert.equal(report.measurement.resources.pidMismatchProtected, true);
  assert.equal(report.measurement.artifacts.deduplicated, true);
  assert.equal(report.measurement.artifacts.rawBytesInSnapshot, false);
  assert.equal(report.measurement.lazy.fastPathUnloaded, true);
  assert.equal(report.measurement.privacy.hiddenReasoningStored, false);
  assert.equal(report.boundaries.productionMemoryPolicyChanged, false);
  assert.equal(report.boundaries.automaticSkillPromotionExecuted, false);
  assert.equal(report.boundaries.directOsBudgetEnforcementCertified, false);
  assert.equal(report.boundaries.longTermSkillSurvivalCertified, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
