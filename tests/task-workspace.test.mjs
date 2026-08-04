import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { TaskWorkspaceService } from '../src/execution/task-workspace.mjs';

const exec = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-task-workspace-'));
  const data = await mkdtemp(path.join(os.tmpdir(), 'forge-task-worktrees-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(data, { recursive: true, force: true }));
  await exec('git', ['init'], { cwd: root });
  await exec('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.txt'), 'base\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'baseline'], { cwd: root });

  const store = new StudioStore(path.join(data, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build', status: 'running' });
  const scout = store.createTask({ id: 'scout', projectId: project.id, missionId: mission.id, title: 'Scout', objective: 'Inspect', role: 'scout', status: 'ready', allowedPaths: ['**'] });
  const builder = store.createTask({ id: 'builder', projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Change', role: 'builder', status: 'ready', dependencies: [scout.id], allowedPaths: ['src/**'] });
  const reviewer = store.createTask({ id: 'reviewer', projectId: project.id, missionId: mission.id, title: 'Review', objective: 'Review', role: 'reviewer', status: 'ready', dependencies: [builder.id], allowedPaths: ['**'] });
  return { root, data, store, project, scout, builder, reviewer, service: new TaskWorkspaceService({ store, worktreesRoot: path.join(data, 'worktrees') }) };
}

test('TaskWorkspaceService keeps read-only roles in project root and creates one isolated builder worktree', async (t) => {
  const f = await fixture(t);
  const scout = await f.service.prepare(f.scout);
  assert.equal(scout.metadata.executionWorkspace, f.root);
  assert.equal(scout.metadata.worktree, undefined);

  const builder = await f.service.prepare(f.builder);
  assert.notEqual(builder.metadata.executionWorkspace, f.root);
  assert.equal(builder.metadata.executionWorkspace, builder.metadata.worktree.path);
  assert.match(builder.metadata.worktree.branch, /^forge\/builder-/);
  assert.equal(await readFile(path.join(builder.metadata.worktree.path, 'src', 'a.txt'), 'utf8'), 'base\n');

  const again = await f.service.prepare(f.store.getTask(builder.id));
  assert.equal(again.metadata.worktree.path, builder.metadata.worktree.path);
});

test('TaskWorkspaceService attaches an independent reviewer to the builder candidate worktree', async (t) => {
  const f = await fixture(t);
  const builder = await f.service.prepare(f.builder);
  await writeFile(path.join(builder.metadata.worktree.path, 'src', 'a.txt'), 'candidate\n');
  const reviewer = await f.service.prepare(f.reviewer);
  assert.equal(reviewer.metadata.executionWorkspace, builder.metadata.worktree.path);
  assert.equal(reviewer.metadata.reviewOfTaskId, builder.id);
  assert.equal(await readFile(path.join(reviewer.metadata.executionWorkspace, 'src', 'a.txt'), 'utf8'), 'candidate\n');
});

test('TaskWorkspaceService rolls back only managed mission worktrees and preserves the project root', async (t) => {
  const f = await fixture(t);
  const builder = await f.service.prepare(f.builder);
  await f.service.prepare(f.reviewer);
  assert.equal(await readFile(path.join(builder.metadata.worktree.path, 'src', 'a.txt'), 'utf8'), 'base\n');

  const result = await f.service.rollbackMission(f.store.getMission(f.builder.missionId).id);

  assert.equal(result.removedWorktrees, 1);
  await assert.rejects(() => readFile(path.join(builder.metadata.worktree.path, 'src', 'a.txt'), 'utf8'), /ENOENT/);
  assert.equal(await readFile(path.join(f.root, 'src', 'a.txt'), 'utf8'), 'base\n');
  assert.equal(f.store.getMission(f.builder.missionId).status, 'rolled-back');
  assert.equal(f.store.getTask(f.builder.id).metadata.worktree, null);
  assert.equal(f.store.getTask(f.reviewer.id).metadata.worktree, null);
});

test('TaskWorkspaceService creates an isolated managed worktree for integrator tasks', async (t) => {
  const f = await fixture(t);
  const integrator = f.store.createTask({
    id: 'integrator', projectId: f.project.id, missionId: f.builder.missionId,
    title: 'Integrate', objective: 'Integrate candidate changes', role: 'integrator', status: 'ready', allowedPaths: ['src/**'],
  });
  const prepared = await f.service.prepare(integrator);
  assert.notEqual(prepared.metadata.executionWorkspace, f.root);
  assert.equal(prepared.metadata.executionWorkspace, prepared.metadata.worktree.path);
  assert.match(prepared.metadata.worktree.branch, /^forge\/integrator-/);
});
