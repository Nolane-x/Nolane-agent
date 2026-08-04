import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { CHECKPOINT_7_HELDOUT_PACKS } from '../src/small-model/checkpoint-7-heldout-pack.mjs';
import { MissionTrajectoryEngine } from '../src/small-model/mission-trajectory-engine.mjs';
import { scoreProcessStep } from '../src/small-model/process-reward-kernel.mjs';
import {
  buildProcessRewardDataset,
  buildProcessRewardSplit,
  trainProcessRewardSpecialist,
  verifyProcessRewardSpecialist,
} from '../src/small-model/process-reward-specialist.mjs';
import { loadModelArtifact } from '../src/small-model/model-artifact.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
let missions;

before(async () => {
  const engine = new MissionTrajectoryEngine({ trainingRepositoryIds: ['nolane-root'] });
  missions = [];
  for (const pack of CHECKPOINT_7_HELDOUT_PACKS) missions.push(await engine.run({ root, pack }));
});

test('process reward scores verified progress neutral work and regression without hidden reasoning', () => {
  const progress = scoreProcessStep(missions[0].steps.find((step) => step.phase === 'recovery-test'));
  const neutral = scoreProcessStep(missions[0].steps.find((step) => step.phase === 'mutate'));
  const regression = scoreProcessStep(missions[0].steps.find((step) => step.phase === 'mutation-test'));
  assert.ok(progress.reward > 0);
  assert.equal(progress.label, 'progress');
  assert.equal(neutral.reward, 0);
  assert.equal(neutral.label, 'neutral');
  assert.ok(regression.reward < 0);
  assert.equal(regression.label, 'regression');
  assert.throws(() => scoreProcessStep({ ...missions[0].steps[0], verifier: { valid: false } }), /valid verifier/i);
  assert.throws(() => scoreProcessStep({ ...missions[0].steps[0], verifier: { valid: true, rewardHacking: true } }), /reward hacking/i);
});

test('process reward dataset splits by repository and preserves every label in train validation and held-out', () => {
  const dataset = buildProcessRewardDataset(missions);
  const split = buildProcessRewardSplit(dataset);
  assert.equal(dataset.examples.length, 21);
  assert.deepEqual(dataset.labels, ['neutral', 'progress', 'regression']);
  assert.equal(new Set([...split.train, ...split.validation, ...split.heldOut].map((item) => item.repositoryId)).size, 3);
  const groups = [split.train, split.validation, split.heldOut].map((items) => [...new Set(items.map((item) => item.repositoryId))]);
  assert.equal(groups[0].some((id) => groups[1].includes(id) || groups[2].includes(id)), false);
  for (const items of [split.train, split.validation, split.heldOut]) assert.deepEqual([...new Set(items.map((item) => item.label))].sort(), dataset.labels);
});

test('process reward specialist trains from mission steps passes held-out ablation and rejects tampering', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-cp7-process-'));
  try {
    const trained = await trainProcessRewardSpecialist({ missions, outputRoot, writeOutputs: true });
    assert.equal(trained.artifact.specialist, 'process-reward');
    assert.ok(trained.artifact.model.training.lossHistory.at(-1) < trained.artifact.model.training.lossHistory[0]);
    assert.ok(trained.validation.accuracy >= 0.8);
    assert.ok(trained.heldOut.accuracy >= 0.8);
    assert.equal(trained.ablation.allowed, true);
    assert.ok(trained.ablation.lift >= 0.1);
    const verified = await verifyProcessRewardSpecialist({ outputRoot });
    assert.equal(verified.status, 'pass');
    const modelPath = path.join(outputRoot, 'model.json');
    const value = JSON.parse(await readFile(modelPath, 'utf8'));
    value.model.biases[0] += 1;
    await writeFile(modelPath, JSON.stringify(value));
    const tampered = await readFile(modelPath);
    assert.throws(() => loadModelArtifact(tampered), /hash mismatch/i);
    await assert.rejects(() => verifyProcessRewardSpecialist({ outputRoot }), /hash mismatch/i);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
