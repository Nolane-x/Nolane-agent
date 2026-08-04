import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { TaskGraph, TaskScheduler } from '../src/orchestration/task-graph.mjs';
import { WorktreeManager } from '../src/execution/worktree-manager.mjs';

const exec = promisify(execFile);

test('TaskGraph rejects cycles and path ownership conflicts, then orders independent work deterministically', () => {
  assert.throws(() => TaskGraph.validate([
    { id: 'a', dependencies: ['b'], allowedPaths: ['src/a/**'] },
    { id: 'b', dependencies: ['a'], allowedPaths: ['src/b/**'] },
  ]), /cycle/i);
  assert.throws(() => TaskGraph.validate([
    { id: 'a', dependencies: [], allowedPaths: ['src/shared/**'] },
    { id: 'b', dependencies: [], allowedPaths: ['src/shared/file.js'] },
  ]), /ownership conflict/i);
  const graph = TaskGraph.validate([
    { id: 'test', dependencies: ['core'], allowedPaths: ['tests/**'] },
    { id: 'docs', dependencies: [], allowedPaths: ['docs/**'] },
    { id: 'core', dependencies: [], allowedPaths: ['src/**'] },
  ]);
  assert.deepEqual(graph.order, ['core', 'docs', 'test']);
  assert.deepEqual(graph.ready(new Map()), ['core', 'docs']);
});

test('TaskScheduler leases ready tasks and rejects stale fencing tokens', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-scheduler-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build' });
  const first = store.createTask({ id: 'task_first', projectId: project.id, missionId: mission.id, title: 'First', objective: 'First', status: 'ready', allowedPaths: ['src/**'] });
  const second = store.createTask({ id: 'task_second', projectId: project.id, missionId: mission.id, title: 'Second', objective: 'Second', status: 'ready', dependencies: [first.id], allowedPaths: ['tests/**'] });
  let nowMs = 1_000;
  const scheduler = new TaskScheduler({ store, now: () => nowMs });
  const lease = scheduler.claim({ missionId: mission.id, workerId: 'worker-a', leaseMs: 100 });
  assert.equal(lease.task.id, first.id);
  assert.equal(lease.fencingToken, 1);
  assert.equal(scheduler.claim({ missionId: mission.id, workerId: 'worker-b', leaseMs: 100 }), null);
  scheduler.heartbeat({ taskId: first.id, workerId: 'worker-a', fencingToken: 1, leaseMs: 100 });
  nowMs += 250;
  const reclaimed = scheduler.claim({ missionId: mission.id, workerId: 'worker-b', leaseMs: 100 });
  assert.equal(reclaimed.task.id, first.id);
  assert.equal(reclaimed.fencingToken, 2);
  assert.throws(() => scheduler.complete({ taskId: first.id, workerId: 'worker-a', fencingToken: 1 }), /stale fencing/i);
  scheduler.complete({ taskId: first.id, workerId: 'worker-b', fencingToken: 2 });
  const next = scheduler.claim({ missionId: mission.id, workerId: 'worker-c', leaseMs: 100 });
  assert.equal(next.task.id, second.id);
});

test('WorktreeManager creates and removes isolated Git worktrees', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-worktree-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec('git', ['init', '-b', 'main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await writeFile(path.join(root, 'README.md'), 'base');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'base'], { cwd: root });
  const manager = new WorktreeManager({ repositoryRoot: root, worktreesRoot: path.join(root, '.forge-worktrees') });
  const created = await manager.create({ taskId: 'task-123', baseRef: 'HEAD' });
  assert.match(created.branch, /^forge\/task-123-/);
  assert.equal(await readFile(path.join(created.path, 'README.md'), 'utf8'), 'base');
  await writeFile(path.join(created.path, 'task.txt'), 'isolated');
  await manager.remove(created, { force: true, deleteBranch: true });
  await assert.rejects(() => readFile(path.join(created.path, 'README.md')), /ENOENT/);
});
