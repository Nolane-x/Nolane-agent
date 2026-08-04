import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CurriculumFactory } from '../src/small-model/curriculum-factory.mjs';

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-curriculum-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.js'), 'export const add = (a,b) => a+b;\n');
  await writeFile(path.join(root, 'README.md'), '# Fixture\n');
  await writeFile(path.join(root, 'LICENSE'), 'MIT fixture\n');
  await symlink(path.join(os.tmpdir(), 'outside'), path.join(root, 'outside-link'));
  return root;
}

test('CurriculumFactory builds a deterministic Gitless real-repository environment and skips symlinks', async () => {
  const root = await makeRepo();
  const factory = new CurriculumFactory();
  const env = await factory.buildEnvironment({ id: 'repo-1', root, license: { spdx: 'MIT', source: 'LICENSE' } });
  assert.equal(env.gitRequired, false);
  assert.equal(env.files.some((file) => file.path === 'src/a.js'), true);
  assert.equal(env.files.some((file) => file.path === 'outside-link'), false);
  assert.match(env.environmentSha256, /^[a-f0-9]{64}$/);
  const again = await factory.buildEnvironment({ id: 'repo-1-copy', root, license: { spdx: 'MIT', source: 'LICENSE' } });
  assert.equal(env.contentSha256, again.contentSha256);
});

test('CurriculumFactory validates declarative mutations with independent baseline and mutant oracles', () => {
  const factory = new CurriculumFactory();
  assert.throws(() => factory.verifyMutation({ sourceText: 'a+b', mutation: { op: 'replace-exact', from: '+', to: '-' }, baselineOracle: { valid: false }, mutantOracle: { valid: true, failureObserved: true } }), /baseline oracle/i);
  const receipt = factory.verifyMutation({
    sourceText: 'a+b', mutation: { op: 'replace-exact', from: '+', to: '-' },
    baselineOracle: { valid: true, independent: true, receiptSha256: 'a'.repeat(64) },
    mutantOracle: { valid: true, independent: true, failureObserved: true, receiptSha256: 'b'.repeat(64) },
  });
  assert.equal(receipt.validMutation, true);
  assert.notEqual(receipt.sourceSha256, receipt.mutantSha256);
});

test('CurriculumFactory separates bug-maker, solver and adversary roles', () => {
  const factory = new CurriculumFactory();
  assert.throws(() => factory.registerRoles({ bugMaker: 'agent-a', solver: 'agent-a', adversary: 'agent-b' }), /separate/i);
  const roles = factory.registerRoles({ bugMaker: 'agent-a', solver: 'agent-b', adversary: 'agent-c' });
  assert.deepEqual(roles, { bugMaker: 'agent-a', solver: 'agent-b', adversary: 'agent-c' });
});

test('CurriculumFactory generates capability-conditioned safety and reward-hacking tasks', async () => {
  const root = await makeRepo();
  const factory = new CurriculumFactory();
  await factory.buildEnvironment({ id: 'repo-1', root, license: { spdx: 'MIT', source: 'LICENSE' } });
  const coding = factory.generateTask({ id: 't1', environmentId: 'repo-1', capability: 'localization', difficulty: 0.3 });
  const safety = factory.generateTask({ id: 't2', environmentId: 'repo-1', capability: 'security', difficulty: 0.6, track: 'safety' });
  const hacking = factory.generateTask({ id: 't3', environmentId: 'repo-1', capability: 'verification', difficulty: 0.8, track: 'reward-hacking' });
  assert.equal(coding.capability, 'localization');
  assert.equal(safety.track, 'safety');
  assert.equal(hacking.hiddenVerifierRequired, true);
});

test('CurriculumFactory reduces trajectories to verified shortest paths and scores the weakest step', () => {
  const factory = new CurriculumFactory();
  const reduced = factory.reduceTrajectory({ steps: [
    { id: 's1', verified: true, effect: { changed: true }, score: 0.9 },
    { id: 's2', verified: true, effect: { changed: false }, score: 0.8 },
    { id: 's3', verified: false, effect: { changed: true }, score: 0.1 },
    { id: 's4', verified: true, effect: { changed: true }, score: 0.6 },
  ] });
  assert.deepEqual(reduced.steps.map((step) => step.id), ['s1', 's4']);
  assert.equal(reduced.weakestStepScore, 0.6);
});

test('CurriculumFactory enforces disjoint repository splits and retains old tasks while increasing difficulty', () => {
  const factory = new CurriculumFactory();
  const splits = factory.defineSplits({ train: ['r1', 'r2'], validation: ['r3'], heldOut: ['r4'] });
  assert.equal(splits.contaminated, false);
  assert.throws(() => factory.defineSplits({ train: ['r1'], validation: ['r1'], heldOut: [] }), /contamination/i);
  const batch = factory.progressCurriculum({
    previous: [{ id: 'old-1', difficulty: 0.2 }, { id: 'old-2', difficulty: 0.4 }],
    frontier: [{ id: 'new-1', difficulty: 0.7 }, { id: 'new-2', difficulty: 0.9 }], retentionRate: 0.5,
  });
  assert.equal(batch.some((task) => task.id.startsWith('old-')), true);
  assert.equal(batch.some((task) => task.id.startsWith('new-')), true);
});

test('CurriculumFactory creates reproducible licensed dataset snapshots', async () => {
  const root = await makeRepo();
  const factory = new CurriculumFactory();
  await factory.buildEnvironment({ id: 'repo-1', root, license: { spdx: 'MIT', source: 'LICENSE' } });
  factory.generateTask({ id: 't1', environmentId: 'repo-1', capability: 'tool-policy', difficulty: 0.5 });
  factory.defineSplits({ train: ['repo-1'], validation: [], heldOut: [] });
  const a = factory.snapshotDataset({ id: 'dataset-1', version: '1' });
  const b = factory.snapshotDataset({ id: 'dataset-1', version: '1' });
  assert.equal(a.datasetSha256, b.datasetSha256);
  assert.deepEqual(a.licenses, [{ environmentId: 'repo-1', spdx: 'MIT', source: 'LICENSE' }]);
});
