import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.27 release gate proves coordinated agents, deterministic replay, and shared experience surfaces', async (t) => {
  for (const relative of [
    'src/release/collaboration-experience-verifier.mjs','scripts/verify-collaboration-experience.mjs','scripts/measure-collaboration-experience.mjs',
    'docs/collaboration-experience-measurement-2.27.0.json','docs/feature-audit-2.27.0.json','docs/LIMITATIONS-2.27.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'multi-agent-collaboration'/);
  assert.match(matrix, /id: 'browser-experience-surface'/);
  const audit = JSON.parse(await readFile('docs/feature-audit-2.27.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 883, partial: 96, external_gate: 56, not_implemented: 115 });
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-227-collaboration-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyCollaborationExperience } = await import('../src/release/collaboration-experience-verifier.mjs');
  const report = await verifyCollaborationExperience({ rootDirectory: path.resolve('.'), version: '2.27.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.equal(report.measurement.collaboration.staleWriteRejected, true);
  assert.equal(report.measurement.collaboration.contractRenegotiated, true);
  assert.equal(report.measurement.collaboration.deadlockRecovered, true);
  assert.equal(report.measurement.collaboration.semanticConflictBlocked, true);
  assert.equal(report.measurement.browser.stateReset, true);
  assert.equal(report.measurement.browser.injectionBlocked, true);
  assert.equal(report.measurement.browser.flakeDetected, true);
  assert.equal(report.measurement.experience.reviewDependencyEnforced, true);
  assert.equal(report.measurement.experience.playbackRewindPlanned, true);
  assert.equal(report.measurement.experience.steeringCapabilityEnforced, true);
  assert.equal(report.measurement.surfaces.httpBounded, true);
  assert.equal(report.measurement.surfaces.webAccessible, true);
  assert.equal(report.measurement.surfaces.vscodeBounded, true);
  assert.equal(report.boundaries.visualOracleCertified, false);
  assert.equal(report.boundaries.jetBrainsParityCertified, false);
  assert.equal(report.boundaries.crossPlatformComputerUseCertified, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
});
