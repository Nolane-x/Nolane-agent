import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { trainBootstrapToolRouter, verifyBootstrapToolRouter } from '../src/small-model/bootstrap-tool-router-training.mjs';
import { loadModelArtifact } from '../src/small-model/model-artifact.mjs';

function nonZeroWeights(artifact) {
  return artifact.model.weights.flat().some((value) => Math.abs(value) > 0);
}

test('bootstrap tool-router training emits deterministic real weights and independent held-out evidence', async (t) => {
  const first = await trainBootstrapToolRouter({ root: process.cwd(), variants: 30 });
  const second = await trainBootstrapToolRouter({ root: process.cwd(), variants: 30 });
  assert.equal(first.artifact.artifactSha256, second.artifact.artifactSha256);
  assert.equal(first.benchmark.receiptSha256, second.benchmark.receiptSha256);
  assert.deepEqual(first.artifact.model.labels, ['patch','read','rollback','search','stop','test']);
  assert.equal(nonZeroWeights(first.artifact), true);
  assert.equal(first.artifact.model.training.lossHistory.at(-1) < first.artifact.model.training.lossHistory[0], true);
  assert.equal(first.benchmark.validation.allowed, true);
  assert.equal(first.benchmark.heldOut.allowed, true);
  assert.equal(first.benchmark.heldOut.accuracy >= 0.95, true);
  assert.equal(first.benchmark.claims.generalCodingIntelligence, false);
  assert.equal(first.benchmark.claims.competitorSuperiority, false);
});

test('bootstrap tool-router files are content-addressed and verifier rejects tampering', async (t) => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'nolane-tool-router-')); t.after(() => rm(outputDir, { recursive: true, force: true }));
  const trained = await trainBootstrapToolRouter({ root: process.cwd(), variants: 30, writeOutputs: true, outputDir });
  const verified = await verifyBootstrapToolRouter({ outputDir });
  assert.equal(verified.status, 'pass');
  const artifact = loadModelArtifact(await readFile(path.join(outputDir, 'model.json')));
  assert.equal(artifact.artifactSha256, trained.artifact.artifactSha256);
  const tampered = JSON.parse(await readFile(path.join(outputDir, 'model.json'), 'utf8'));
  tampered.model.weights[0][0] += 1;
  await assert.rejects(() => verifyBootstrapToolRouter({ outputDir, artifactOverride: tampered }), /hash mismatch/i);
});
