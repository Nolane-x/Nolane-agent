import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('beyond-NolaneNative proof intelligence release gate proves production wiring and keeps comparative claims locked', async (t) => {
  const required = [
    'src/superiority/proof-mission-compiler.mjs',
    'src/superiority/causal-repository-twin.mjs',
    'src/superiority/adversarial-solution-tournament.mjs',
    'src/superiority/adaptive-model-governor.mjs',
    'src/runtime/superiority-plane.mjs',
    'src/release/nolane-proof-intelligence-verifier.mjs',
    'scripts/verify-nolane-proof-intelligence.mjs',
    'scripts/measure-nolane-proof-intelligence.mjs',
    'docs/nolane-proof-intelligence-measurement-5.0.0-beta.6.json',
    'docs/NOLANE-PROOF-INTELLIGENCE.md',
  ];
  for (const relative of required) assert.equal(await exists(relative), true, `${relative} is missing`);
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'nolane-proof-intelligence'/);

  const output = await mkdtemp(path.join(os.tmpdir(), 'nolane-superiority-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyNolaneProofIntelligence } = await import('../src/release/nolane-proof-intelligence-verifier.mjs');
  const report = await verifyNolaneProofIntelligence({ rootDirectory: path.resolve('.'), version: '5.0.0-beta.6', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.equal(report.measurement.proof.deployAllowedAfterEvidence, true);
  assert.equal(report.measurement.proof.deployDeniedBeforeEvidence, true);
  assert.equal(report.measurement.repositoryTwin.staleEdgeExcluded, true);
  assert.equal(report.measurement.tournament.criticalCandidateRejected, true);
  assert.equal(report.measurement.tournament.independentCandidateSelected, true);
  assert.equal(report.measurement.modelGovernor.easyUsesSmall, true);
  assert.equal(report.measurement.modelGovernor.riskyUsesIndependentVerifier, true);
  assert.equal(report.measurement.modelGovernor.privateUsesLocal, true);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.equal(report.boundaries.automaticDeploymentClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
