import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.21 release gate proves repository intelligence behavior without claiming an operated ONNX pack', async (t) => {
  for (const relative of [
    'src/release/repository-intelligence-fabric-verifier.mjs',
    'scripts/verify-repository-intelligence-fabric.mjs',
    'scripts/measure-repository-intelligence-fabric.mjs',
    'docs/repository-intelligence-fabric-measurement-2.21.0.json',
    'docs/feature-audit-2.21.0.json',
    'docs/LIMITATIONS-2.21.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'repository-intelligence-fabric'/);
  const audit = JSON.parse(await readFile('docs/feature-audit-2.21.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 768, partial: 25, external_gate: 56, not_implemented: 301 });
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-221-intelligence-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyRepositoryIntelligenceFabric } = await import('../src/release/repository-intelligence-fabric-verifier.mjs');
  const report = await verifyRepositoryIntelligenceFabric({ rootDirectory: path.resolve('.'), version: '2.21.0', outputFile: path.join(output, 'report.json') });
  const { verifyDecisionEfficiencyLoop } = await import('../src/release/decision-efficiency-loop-verifier.mjs');
  const inheritedDecisionGate = await verifyDecisionEfficiencyLoop({ rootDirectory: path.resolve('.'), version: '2.21.0', outputFile: path.join(output, 'decision.json') });
  assert.equal(inheritedDecisionGate.status, 'pass');
  assert.equal(report.status, 'pass');
  assert.ok(report.measurement.retrieval.candidateCount <= 300);
  assert.ok(report.measurement.retrieval.scannedChunks >= report.measurement.retrieval.candidateCount);
  assert.equal(report.measurement.fallback.degraded, true);
  assert.equal(report.measurement.digitalTwin.citationsValid, true);
  assert.equal(report.boundaries.operatedOnnxModelClaimed, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
