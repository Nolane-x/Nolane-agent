import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createAdaptiveHarnessLab } from '../src/providers/adaptive-harness-lab.mjs';
import { WorldDevelopmentPlane } from '../src/runtime/world-development-plane.mjs';

const H = (ch) => ch.repeat(64);

test('AdaptiveHarnessLab exposes Adaptive Learning lazily and closes its lifecycle', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-learning-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lab = createAdaptiveHarnessLab({ dataDir: root, learning: { capabilityMatrixRevision: H('1'), cohorts: ['local'], challengeRevisionSha256: H('2') } });
  assert.equal(lab.publicView().learning.lifecycle.loaded, false);
  const encoded = lab.learning.encodeTask({ taskId: 't', taskType: 'bugfix', languages: ['js'], repoSize: {}, risk: 0.2, context: {}, tools: ['test'], localOnly: true });
  assert.equal(encoded.taskType, 'bugfix');
  assert.equal(lab.publicView().learning.lifecycle.loaded, true);
  lab.close();
  assert.equal(lab.learningSnapshot().lifecycle.closed, true);
  assert.throws(() => lab.learning.encodeTask({}), /closed/i);
});

test('WorldDevelopmentPlane exposes trajectory and teacher challenges lazily', () => {
  const plane = new WorldDevelopmentPlane({ adaptiveLearning: { cohorts: ['local'], challengeRevisionSha256: H('3') } });
  assert.equal(plane.snapshot().lifecycle.adaptiveLearningLoaded, false);
  const challenge = plane.createTeacherChallenges({ seed: 's', language: 'js', source: 'const x=1', expected: { value: 1 } });
  assert.equal(challenge.executor.challenges.length, 5);
  assert.equal(plane.snapshot().lifecycle.adaptiveLearningLoaded, true);
  plane.close();
  assert.throws(() => plane.createTeacherChallenges({}), /closed/i);
});

test('src/app.mjs does not construct AdaptiveLearningControlPlane directly', async () => {
  const app = await readFile('src/app.mjs', 'utf8');
  assert.doesNotMatch(app, /AdaptiveLearningControlPlane|adaptive-learning-control-plane/);
});
