import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { trainBootstrapSpecialistSuite, verifyBootstrapSpecialistSuite } from '../src/small-model/bootstrap-specialist-suite-training.mjs';

const specialists = ['context-scorer', 'patch-ranker', 'risk-classifier', 'test-selector'];

test('bootstrap specialist suite trains four real artifacts with decreasing loss and held-out evidence', async () => {
  const result = await trainBootstrapSpecialistSuite({ root: process.cwd(), variants: 18 });
  assert.deepEqual(Object.keys(result.specialists), specialists);
  for (const specialist of specialists) {
    const value = result.specialists[specialist];
    assert.equal(value.artifact.specialist, specialist);
    assert.ok(value.artifact.model.weights.flat().some((weight) => weight !== 0));
    const losses = value.artifact.model.training.lossHistory;
    assert.ok(losses.at(-1) < losses[0]);
    assert.equal(value.validation.allowed, true);
    assert.equal(value.heldOut.allowed, true);
    assert.ok(value.heldOut.accuracy >= 0.95);
    assert.equal(value.benchmark.claims.generalCodingIntelligence, false);
    assert.equal(value.benchmark.claims.competitorSuperiority, false);
  }
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('bootstrap specialist suite writes reproducible artifacts and rejects tampering', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-specialist-suite-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const written = await trainBootstrapSpecialistSuite({ root: process.cwd(), variants: 12, writeOutputs: true, outputRoot: root });
  const verified = await verifyBootstrapSpecialistSuite({ outputRoot: root });
  assert.equal(verified.status, 'pass');
  assert.deepEqual(verified.artifactSha256BySpecialist, Object.fromEntries(specialists.map((specialist) => [specialist, written.specialists[specialist].artifact.artifactSha256])));
  const target = path.join(root, 'risk-classifier', 'bootstrap-v1', 'model.json');
  const artifact = JSON.parse(await readFile(target, 'utf8'));
  artifact.model.biases[0] += 1;
  await assert.rejects(() => verifyBootstrapSpecialistSuite({ outputRoot: root, artifactOverrides: { 'risk-classifier': JSON.stringify(artifact) } }), /hash mismatch/i);
});
