import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRepositorySpecialistDataset, REPOSITORY_SPECIALISTS } from '../src/small-model/repository-specialist-suite-dataset.mjs';
import { trainRepositorySpecialistSuite, verifyRepositorySpecialistSuite } from '../src/small-model/repository-specialist-suite-training.mjs';

const trajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1');

test('repository specialist datasets derive labels from verified trajectory lineage without leaking labels into state', async () => {
  for (const specialist of REPOSITORY_SPECIALISTS) {
    const dataset = await buildRepositorySpecialistDataset({ trajectoryDir, specialist });
    assert.equal(dataset.examples.length, 32);
    assert.ok(dataset.labels.length >= 4);
    assert.equal(dataset.hiddenChainOfThoughtStored, false);
    assert.equal(dataset.labelSource, 'observed-repository-trajectory-policy');
    assert.match(dataset.trajectoryDatasetReceiptSha256, /^[a-f0-9]{64}$/);
    for (const example of dataset.examples) {
      assert.equal(example.state.labels, undefined);
      assert.equal(example.state.expectedLabel, undefined);
      assert.equal(example.verifier.independent, true);
      assert.match(example.verifier.receiptSha256, /^[a-f0-9]{64}$/);
      assert.ok(example.state.testPath.startsWith('tests/'));
    }
  }
});

test('repository specialist suite trains content-addressed artifacts with disjoint held-out repository groups', async (t) => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nolane-repository-specialists-'));
  t.after(() => fs.rm(outputRoot, { recursive: true, force: true }));
  const suite = await trainRepositorySpecialistSuite({ trajectoryDir, outputRoot, writeOutputs: true });
  assert.deepEqual(Object.keys(suite.specialists).sort(), [...REPOSITORY_SPECIALISTS].sort());
  for (const specialist of REPOSITORY_SPECIALISTS) {
    const value = suite.specialists[specialist];
    assert.ok(value.artifact.model.training.lossHistory.at(-1) < value.artifact.model.training.lossHistory[0]);
    assert.ok(value.validation.accuracy >= 0.8, `${specialist} validation accuracy`);
    assert.ok(value.heldOut.accuracy >= 0.8, `${specialist} held-out accuracy`);
    const trainGroups = new Set(value.split.train.map((entry) => entry.scenarioGroup));
    const heldGroups = new Set(value.split.heldOut.map((entry) => entry.scenarioGroup));
    assert.equal([...heldGroups].some((group) => trainGroups.has(group)), false);
    assert.equal(value.benchmark.claims.generalCodingIntelligence, false);
    assert.equal(value.benchmark.claims.competitorSuperiority, false);
  }
  const verified = await verifyRepositorySpecialistSuite({ outputRoot });
  assert.equal(verified.status, 'pass');
  assert.equal(Object.keys(verified.artifactSha256BySpecialist).length, REPOSITORY_SPECIALISTS.length);
});

test('repository specialist suite rejects trajectory lineage tampering', async (t) => {
  const copied = await fs.mkdtemp(path.join(os.tmpdir(), 'nolane-trajectory-tamper-'));
  t.after(() => fs.rm(copied, { recursive: true, force: true }));
  await fs.cp(trajectoryDir, copied, { recursive: true });
  await fs.appendFile(path.join(copied, 'episodes.jsonl'), '{"tampered":true}\n');
  await assert.rejects(
    buildRepositorySpecialistDataset({ trajectoryDir: copied, specialist: 'risk-classifier' }),
    /trajectory dataset hash mismatch/i,
  );
});
