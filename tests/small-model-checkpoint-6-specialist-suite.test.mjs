import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  CHECKPOINT_6_SPECIALISTS,
  buildCheckpoint6SpecialistDataset,
  buildCheckpoint6SpecialistSplit,
} from '../src/small-model/checkpoint-6-specialist-dataset.mjs';
import {
  evaluateMajorityBaseline,
  fitMajorityBaseline,
  runCheckpoint6Ablation,
} from '../src/small-model/checkpoint-6-ablation-runner.mjs';
import {
  trainCheckpoint6SpecialistSuite,
  verifyCheckpoint6SpecialistSuite,
} from '../src/small-model/checkpoint-6-specialist-training.mjs';
import { trainLinearPolicy } from '../src/small-model/linear-policy-trainer.mjs';
import { createModelArtifact } from '../src/small-model/model-artifact.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const root = process.cwd();
const repositoryTrajectoryDir = path.join(root, 'datasets', 'trajectories', 'repository-v1');
const multiRuntimeDir = path.join(root, 'datasets', 'trajectories', 'multi-runtime-v1');

function syntheticExample(id, label, group, safetyCritical = false) {
  return {
    id,
    scenarioGroup: group,
    state: { id, group, safetyCritical },
    action: { type: label },
  };
}

test('checkpoint 6 dataset combines repository multi-runtime and recovery lineage without hidden reasoning', async () => {
  const dataset = await buildCheckpoint6SpecialistDataset({
    repositoryTrajectoryDir,
    multiRuntimeDir,
    specialist: 'risk-classifier',
  });
  assert.equal(dataset.examples.length, 45);
  assert.deepEqual(dataset.lineage.runtimes, ['go', 'node', 'python']);
  assert.ok(dataset.lineage.projects.length >= 5);
  assert.equal(dataset.lineage.repositoryEpisodes, 32);
  assert.equal(dataset.lineage.multiRuntimeEpisodes, 7);
  assert.equal(dataset.lineage.recoveryEpisodes, 6);
  assert.equal(dataset.lineage.mutationObserved, true);
  assert.equal(dataset.lineage.recoveryObserved, true);
  assert.equal(dataset.hiddenChainOfThoughtStored, false);
  assert.equal(dataset.claims.generalCodingIntelligence, false);
});

test('checkpoint 6 split is group disjoint and preserves every label in train validation and held-out', async () => {
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
    const split = buildCheckpoint6SpecialistSplit({ dataset, seed: `test:${specialist}` });
    const groupSets = Object.fromEntries(['train', 'validation', 'heldOut'].map((key) => [key, new Set(split[key].map((entry) => entry.scenarioGroup))]));
    assert.equal([...groupSets.train].some((value) => groupSets.validation.has(value) || groupSets.heldOut.has(value)), false);
    assert.equal([...groupSets.validation].some((value) => groupSets.heldOut.has(value)), false);
    for (const label of dataset.labels) {
      assert.ok(split.train.some((entry) => entry.action.type === label), `${specialist}:${label}:train`);
      assert.ok(split.validation.some((entry) => entry.action.type === label), `${specialist}:${label}:validation`);
      assert.ok(split.heldOut.some((entry) => entry.action.type === label), `${specialist}:${label}:heldOut`);
    }
  }
});

test('majority baseline is fitted only from training labels', () => {
  const train = [
    syntheticExample('a1', 'accept', 'a1'),
    syntheticExample('a2', 'accept', 'a2'),
    syntheticExample('r1', 'reject', 'r1', true),
  ];
  const heldOut = Array.from({ length: 10 }, (_, index) => syntheticExample(`r${index + 2}`, 'reject', `h${index}`, true));
  const baseline = fitMajorityBaseline({ examples: train });
  assert.equal(baseline.label, 'accept');
  const result = evaluateMajorityBaseline({ baseline, examples: heldOut });
  assert.equal(result.correct, 0);
  assert.equal(result.safetyViolations, 10);
});

test('ablation requires material held-out lift and no safety regression', () => {
  const train = [
    syntheticExample('a1', 'accept', 'a1'),
    syntheticExample('a2', 'accept', 'a2'),
    syntheticExample('r1', 'reject', 'r1', true),
    syntheticExample('r2', 'reject', 'r2', true),
  ];
  const heldOut = [
    syntheticExample('a3', 'accept', 'a3'),
    syntheticExample('r3', 'reject', 'r3', true),
  ];
  const model = trainLinearPolicy({ examples: train, dimensions: 64, epochs: 180, learningRate: 0.15, seed: 'ablation-test' });
  const artifact = createModelArtifact({
    model,
    datasetReceiptSha256: canonicalSha256({ split: 'ablation-test' }),
    trainingConfig: { dimensions: 64, epochs: 180, learningRate: 0.15, seed: 'ablation-test' },
    specialist: 'patch-ranker',
  });
  const result = runCheckpoint6Ablation({ artifact, train, heldOut, minLift: 0.1 });
  assert.equal(result.allowed, true);
  assert.ok(result.lift >= 0.1);
  assert.ok(result.model.safetyViolations <= result.baselineEvaluation.safetyViolations);

  const noLift = runCheckpoint6Ablation({ artifact, train, heldOut: [syntheticExample('a4', 'accept', 'a4')], minLift: 0.1 });
  assert.equal(noLift.allowed, false);
  assert.match(noLift.reasons.join(' '), /lift/i);
});

test('checkpoint 6 suite writes five ablation-eligible artifacts and rejects tampering', async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nolane-checkpoint-6-models-'));
  try {
    const trained = await trainCheckpoint6SpecialistSuite({ repositoryTrajectoryDir, multiRuntimeDir, outputRoot, writeOutputs: true });
    assert.equal(Object.keys(trained.specialists).length, 5);
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const value = trained.specialists[specialist];
      assert.equal(value.ablation.allowed, true, specialist);
      assert.ok(value.ablation.lift >= 0.1, specialist);
      assert.ok(value.benchmark.heldOut.accuracy >= 0.8, specialist);
      assert.ok(value.datasetReceipt.lineage.projects.length >= 5, specialist);
      assert.equal(value.datasetReceipt.lineage.mutationObserved, true, specialist);
      assert.equal(value.datasetReceipt.lineage.recoveryObserved, true, specialist);
    }
    const verified = await verifyCheckpoint6SpecialistSuite({ outputRoot });
    assert.equal(verified.status, 'pass');
    assert.equal(Object.keys(verified.artifactSha256BySpecialist).length, 5);

    const modelPath = path.join(outputRoot, 'risk-classifier', 'multi-runtime-v1', 'model.json');
    const model = JSON.parse(await fs.readFile(modelPath, 'utf8'));
    model.model.biases[0] += 1;
    await fs.writeFile(modelPath, `${JSON.stringify(model)}\n`);
    await assert.rejects(() => verifyCheckpoint6SpecialistSuite({ outputRoot }), /hash mismatch/i);
  } finally {
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});
