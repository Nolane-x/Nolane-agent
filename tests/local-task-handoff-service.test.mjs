import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { TaskWorkspaceService } from '../src/execution/task-workspace.mjs';
import { LocalTaskHandoffService } from '../src/execution/local-task-handoff-service.mjs';

const exec = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-local-handoff-repo-'));
  const data = await mkdtemp(path.join(os.tmpdir(), 'forge-local-handoff-data-'));
  await exec('git', ['init'], { cwd: root });
  await exec('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'index.mjs'), 'export const value = 1;\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'baseline'], { cwd: root });

  const store = new StudioStore(path.join(data, 'studio.db'));
  t.after(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
    await rm(data, { recursive: true, force: true });
  });
  const project = store.createProject({ name: 'Local project', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Implement locally', status: 'running' });
  const otherMission = store.createMission({ projectId: project.id, objective: 'Other', status: 'running' });
  const scout = store.createTask({
    id: 'scout', projectId: project.id, missionId: mission.id, title: 'Scout', objective: 'Inspect', role: 'scout', status: 'done',
    metadata: { handoff: { schema: 'forge.task.handoff.v1', handoffSha256: 'a'.repeat(64), receiptSha256s: ['b'.repeat(64)] } },
  });
  const builder = store.createTask({
    id: 'builder', projectId: project.id, missionId: mission.id, title: 'Builder', objective: 'Change source', role: 'builder', status: 'ready',
    dependencies: [scout.id], allowedPaths: ['src/**'], deniedPaths: ['.env'], metadata: { baseRef: 'HEAD' },
  });
  const olderBuilder = store.createTask({
    id: 'older-builder', projectId: project.id, missionId: mission.id, title: 'Older', objective: 'Older task', role: 'builder', status: 'done',
    dependencies: [], allowedPaths: ['tests/**'], metadata: { baseRef: 'HEAD' },
  });
  const foreignTask = store.createTask({
    id: 'foreign-builder', projectId: project.id, missionId: otherMission.id, title: 'Foreign', objective: 'Foreign task', role: 'builder', status: 'ready',
  });
  const workspaceService = new TaskWorkspaceService({ store, worktreesRoot: path.join(data, 'worktrees') });
  const service = new LocalTaskHandoffService({ store, workspaceService, now: () => '2026-07-29T13:40:00.000Z' });
  return { root, data, store, project, mission, otherMission, scout, builder, olderBuilder, foreignTask, workspaceService, service };
}

test('LocalTaskHandoffService requires an authenticated principal', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    () => f.service.prepare({ missionId: f.mission.id }),
    (error) => error.code === 'LOCAL_HANDOFF_PRINCIPAL_REQUIRED',
  );
});

test('LocalTaskHandoffService prepares the eligible task in a managed worktree and persists an immutable receipt', async (t) => {
  const f = await fixture(t);
  const result = await f.service.prepare({ missionId: f.mission.id, principalId: 'user-local' });

  assert.equal(result.schema, 'forge.local-task-handoff.v1');
  assert.equal(result.projectId, f.project.id);
  assert.equal(result.missionId, f.mission.id);
  assert.equal(result.taskId, f.builder.id);
  assert.equal(result.executionTarget, 'local');
  assert.equal(result.principalId, 'user-local');
  assert.equal(result.preparedAt, '2026-07-29T13:40:00.000Z');
  assert.deepEqual(result.dependencies, ['scout']);
  assert.deepEqual(result.allowedPaths, ['src/**']);
  assert.deepEqual(result.deniedPaths, ['.env']);
  assert.deepEqual(result.dependencyHandoffs, [{ taskId: 'scout', handoffSha256: 'a'.repeat(64), receiptSha256s: ['b'.repeat(64)] }]);
  assert.match(result.worktree.branch, /^forge\/builder-/);
  assert.equal(result.localWorkspace, result.worktree.path);
  await access(result.localWorkspace);
  const { receiptSha256, ...base } = result;
  assert.equal(receiptSha256, canonicalSha256(base));

  const stored = f.store.getTask(f.builder.id);
  assert.equal(stored.metadata.executionTarget, 'local');
  assert.deepEqual(stored.metadata.localHandoff, result);
  const event = f.store.listEvents().find((item) => item.type === 'task.local-handoff.prepared');
  assert.equal(event.refs.projectId, f.project.id);
  assert.equal(event.refs.missionId, f.mission.id);
  assert.equal(event.refs.taskId, f.builder.id);
  assert.equal(event.payload.receiptSha256, result.receiptSha256);
  assert.equal(event.payload.localWorkspace, undefined);
});

test('LocalTaskHandoffService reuses the same worktree and persisted handoff idempotently', async (t) => {
  const f = await fixture(t);
  const first = await f.service.prepare({ missionId: f.mission.id, taskId: f.builder.id, principalId: 'user-local' });
  const second = await f.service.prepare({ missionId: f.mission.id, taskId: f.builder.id, principalId: 'user-local' });
  assert.deepEqual(second, first);
  assert.equal(f.store.listEvents().filter((item) => item.type === 'task.local-handoff.prepared').length, 1);
});

test('LocalTaskHandoffService rejects cross-mission and ineligible explicit tasks', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    () => f.service.prepare({ missionId: f.mission.id, taskId: f.foreignTask.id, principalId: 'user-local' }),
    (error) => error.code === 'LOCAL_HANDOFF_TASK_MISSION_MISMATCH',
  );
  await assert.rejects(
    () => f.service.prepare({ missionId: f.mission.id, taskId: f.scout.id, principalId: 'user-local' }),
    (error) => error.code === 'LOCAL_HANDOFF_TASK_ROLE_UNSUPPORTED',
  );
});

test('LocalTaskHandoffService returns only the persisted handoff to its preparing principal', async (t) => {
  const f = await fixture(t);
  const prepared = await f.service.prepare({ missionId: f.mission.id, taskId: f.builder.id, principalId: 'user-local' });
  assert.deepEqual(f.service.get({ taskId: f.builder.id, principalId: 'user-local' }), prepared);
  assert.throws(
    () => f.service.get({ taskId: f.builder.id, principalId: 'other-user' }),
    (error) => error.code === 'LOCAL_HANDOFF_PRINCIPAL_MISMATCH',
  );
  assert.throws(
    () => f.service.get({ taskId: f.olderBuilder.id, principalId: 'user-local' }),
    (error) => error.code === 'LOCAL_HANDOFF_NOT_FOUND',
  );
});
