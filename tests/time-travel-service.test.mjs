import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { TimeTravelService } from '../src/time-travel/time-travel-service.mjs';

const exec = promisify(execFile);
async function git(root, args) { return exec('git', args, { cwd: root, windowsHide: true }); }

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-time-travel-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo'); const dataDir = path.join(root, 'data');
  await mkdir(repo, { recursive: true });
  await git(repo, ['init']); await git(repo, ['config', 'user.email', 'test@nolane.local']); await git(repo, ['config', 'user.name', 'Nolane Test']);
  await writeFile(path.join(repo, 'app.txt'), 'v1\n'); await writeFile(path.join(repo, 'old.txt'), 'old\n');
  await git(repo, ['add', '.']); await git(repo, ['commit', '-m', 'initial']);
  const store = new StudioStore(path.join(dataDir, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'Repo', workspaceRoot: repo });
  const mission = store.createMission({ projectId: project.id, objective: 'Implement feature', status: 'running' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Build feature', objective: 'Build feature', status: 'running', role: 'builder', dependencies: [] });
  const service = new TimeTravelService({ dataDir, store, clock: () => '2026-08-04T00:00:00.000Z' });
  return { root, repo, dataDir, store, project, mission, task, service };
}

test('Time Travel captures dirty project state, compares, restores one file, branches, replays, and exports evidence', async (t) => {
  const { repo, dataDir, mission, service } = await fixture(t);
  await writeFile(path.join(repo, 'app.txt'), 'v2 checkpoint\n');
  await writeFile(path.join(repo, 'new.txt'), 'new checkpoint\n');
  await writeFile(path.join(repo, '.env'), 'API_KEY=secret\n');
  const checkpoint = await service.create({ missionId: mission.id, label: 'Before refactor' });
  assert.equal(checkpoint.schema, 'nolane.time-travel-checkpoint.v1');
  assert.equal(checkpoint.manifest.some((item) => item.path === 'app.txt'), true);
  assert.equal(checkpoint.manifest.some((item) => item.path === 'new.txt'), true);
  assert.equal(checkpoint.excluded.some((item) => item.path === '.env'), true);
  assert.equal(checkpoint.completeWorkingTreeCapture, false);
  assert.equal((await stat(path.join(dataDir, 'time-travel', 'checkpoint-index.json'))).mode & 0o777, 0o600);

  await writeFile(path.join(repo, 'app.txt'), 'v3 current\n');
  await rm(path.join(repo, 'new.txt'));
  const comparison = await service.compare(checkpoint.id);
  assert.equal(comparison.schema, 'nolane.time-travel-comparison.v1');
  assert.equal(comparison.changes.some((item) => item.path === 'app.txt'), true);
  assert.equal(comparison.changes.some((item) => item.path === 'new.txt'), true);

  await assert.rejects(() => service.restoreFile({ checkpointId: checkpoint.id, path: 'app.txt' }), (error) => error.code === 'TIME_TRAVEL_CONFIRMATION_REQUIRED');
  const restored = await service.restoreFile({ checkpointId: checkpoint.id, path: 'app.txt', confirmOverwrite: true });
  assert.equal(restored.state, 'restored');
  assert.equal(await readFile(path.join(repo, 'app.txt'), 'utf8'), 'v2 checkpoint\n');
  assert.match(restored.backup.sha256, /^[a-f0-9]{64}$/);

  const branch = await service.createBranch({ checkpointId: checkpoint.id, label: 'Explore old path' });
  assert.equal(await readFile(path.join(branch.worktree.path, 'app.txt'), 'utf8'), 'v2 checkpoint\n');
  assert.equal(await readFile(path.join(branch.worktree.path, 'new.txt'), 'utf8'), 'new checkpoint\n');
  await assert.rejects(() => readFile(path.join(branch.worktree.path, '.env'), 'utf8'));

  const replay = await service.replayMission({ checkpointId: checkpoint.id, objective: 'Replay feature safely' });
  assert.equal(replay.schema, 'nolane.time-travel-replay-receipt.v1');
  assert.equal(replay.mission.objective, 'Replay feature safely');
  assert.equal(replay.tasks.length, 1);
  assert.equal(replay.tasks[0].sourceTaskId != null, true);

  const bundle = await service.exportEvidence(checkpoint.id);
  assert.equal(bundle.schema, 'nolane.time-travel-evidence-bundle.v1');
  assert.equal(bundle.checkpoint.id, checkpoint.id);
  assert.equal(bundle.executionStory, null);
  assert.match(bundle.receiptSha256, /^[a-f0-9]{64}$/);
});

test('Time Travel rejects path traversal before restore', async (t) => {
  const { repo, mission, service } = await fixture(t);
  await writeFile(path.join(repo, 'app.txt'), 'checkpoint\n');
  const checkpoint = await service.create({ missionId: mission.id });
  await assert.rejects(() => service.restoreFile({ checkpointId: checkpoint.id, path: '../outside.txt', confirmOverwrite: true }), (error) => error.code === 'TIME_TRAVEL_PATH_ESCAPE');
});
