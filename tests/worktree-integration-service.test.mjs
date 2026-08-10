import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { WorktreeIntegrationService } from '../src/execution/worktree-integration-service.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const exec = promisify(execFile);

async function git(cwd, args) {
  return exec('git', args, { cwd, timeout: 30_000, maxBuffer: 1024 * 1024 });
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-integration-root-'));
  const data = await mkdtemp(path.join(os.tmpdir(), 'forge-integration-data-'));
  let store;
  t.after(async () => {
    store?.close();
    await git(root, ['worktree', 'prune']).catch(() => {});
    await rm(root, { recursive: true, force: true });
    await rm(data, { recursive: true, force: true });
  });
  await git(root, ['init']);
  await git(root, ['config', 'core.autocrlf', 'false']);
  await git(root, ['config', 'user.email', 'forge@example.test']);
  await git(root, ['config', 'user.name', 'Forge Test']);
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'base.txt'), 'base\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);

  const worktreesRoot = path.join(data, 'worktrees');
  await mkdir(worktreesRoot, { recursive: true });
  const aPath = path.join(worktreesRoot, 'builder-a');
  const bPath = path.join(worktreesRoot, 'builder-b');
  await git(root, ['worktree', 'add', '-b', 'forge/builder-a', aPath, 'HEAD']);
  await git(root, ['worktree', 'add', '-b', 'forge/builder-b', bPath, 'HEAD']);
  await writeFile(path.join(aPath, 'src', 'a.txt'), 'a\n');
  await git(aPath, ['add', '.']);
  await git(aPath, ['commit', '-m', 'builder a']);
  await writeFile(path.join(bPath, 'src', 'b.txt'), 'b\n');
  await git(bPath, ['add', '.']);
  await git(bPath, ['commit', '-m', 'builder b']);

  store = new StudioStore(path.join(data, 'studio.db'));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Integrate builders', status: 'running' });
  const scout = store.createTask({ id: 'scout', projectId: project.id, missionId: mission.id, title: 'Scout', objective: 'Inspect', role: 'scout', status: 'done', allowedPaths: ['docs/**'] });
  const builderA = store.createTask({ id: 'builder-a', projectId: project.id, missionId: mission.id, title: 'A', objective: 'Add A', role: 'builder', status: 'done', dependencies: [scout.id], allowedPaths: ['src/a.txt'], metadata: { worktree: { path: aPath, branch: 'forge/builder-a', baseRef: 'HEAD' } } });
  const builderB = store.createTask({ id: 'builder-b', projectId: project.id, missionId: mission.id, title: 'B', objective: 'Add B', role: 'builder', status: 'done', dependencies: [builderA.id], allowedPaths: ['src/b.txt'], metadata: { worktree: { path: bPath, branch: 'forge/builder-b', baseRef: 'HEAD' } } });
  return { root, data, worktreesRoot, store, project, mission, builderA, builderB };
}

test('WorktreeIntegrationService rebases and fast-forwards builder branches in dependency order and tests after every merge', async (t) => {
  const f = await fixture(t);
  const calls = [];
  const service = new WorktreeIntegrationService({
    store: f.store,
    integrationsRoot: path.join(f.data, 'integrations'),
    approval: async (request) => ({ approved: true, id: 'approval-1', request }),
    commandRunner: async ({ command, args, cwd }) => {
      calls.push([command, ...args]);
      return exec(command, args, { cwd, timeout: 30_000, maxBuffer: 1024 * 1024 });
    },
  });
  const result = await service.integrate({
    missionId: f.mission.id,
    targetRef: 'HEAD',
    verificationCommands: [{ command: process.execPath, args: ['-e', "const fs=require('fs'); if(!fs.existsSync('src/base.txt')) process.exit(2)"] }],
  });
  assert.deepEqual(result.taskOrder, ['builder-a', 'builder-b']);
  assert.equal(result.status, 'pass');
  assert.equal(await readFile(path.join(result.integrationWorkspace, 'src', 'a.txt'), 'utf8'), 'a\n');
  assert.equal(await readFile(path.join(result.integrationWorkspace, 'src', 'b.txt'), 'utf8'), 'b\n');
  assert.equal(calls.filter((call) => call[0] === process.execPath).length, 2);
  assert.equal(result.steps.filter((step) => step.operation === 'verify').length, 2);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const mission = f.store.getMission(f.mission.id);
  assert.equal(mission.metadata.integrationWorkspace, result.integrationWorkspace);
  assert.deepEqual(mission.metadata.integrationTaskOrder, ['builder-a', 'builder-b']);
});

test('WorktreeIntegrationService rejects unapproved integration before changing branches', async (t) => {
  const f = await fixture(t);
  const beforeA = (await git(f.builderA.metadata.worktree.path, ['rev-parse', 'HEAD'])).stdout.trim();
  const service = new WorktreeIntegrationService({
    store: f.store,
    integrationsRoot: path.join(f.data, 'integrations'),
    approval: async () => ({ approved: false, id: 'approval-denied' }),
  });
  await assert.rejects(() => service.integrate({ missionId: f.mission.id, verificationCommands: [{ command: process.execPath, args: ['-e', ''] }] }), (error) => error.code === 'WORKTREE_INTEGRATION_APPROVAL_DENIED');
  assert.equal((await git(f.builderA.metadata.worktree.path, ['rev-parse', 'HEAD'])).stdout.trim(), beforeA);
});

test('WorktreeIntegrationService preserves the isolated integration workspace and records failure when post-merge tests fail', async (t) => {
  const f = await fixture(t);
  const service = new WorktreeIntegrationService({
    store: f.store,
    integrationsRoot: path.join(f.data, 'integrations'),
    approval: async () => ({ approved: true, id: 'approval-2' }),
  });
  await assert.rejects(() => service.integrate({
    missionId: f.mission.id,
    verificationCommands: [{ command: process.execPath, args: ['-e', 'process.exit(7)'] }],
  }), (error) => {
    assert.equal(error.code, 'WORKTREE_INTEGRATION_VERIFICATION_FAILED');
    assert.ok(error.integrationWorkspace);
    assert.equal(error.taskId, 'builder-a');
    return true;
  });
  const mission = f.store.getMission(f.mission.id);
  assert.equal(mission.metadata.integrationStatus, 'failed');
  assert.ok(mission.metadata.integrationWorkspace);
});

test('WorktreeIntegrationService blocks before approval when Git collision preflight is not ready', async (t) => {
  const f = await fixture(t);
  let approvals = 0;
  const service = new WorktreeIntegrationService({
    store: f.store,
    integrationsRoot: path.join(f.data, 'integrations'),
    approval: async () => { approvals += 1; return { approved: true }; },
    collisionGovernance: {
      collisionMap: async () => Object.freeze({ schema: 'forge.git-collision-map.v1', ready: false, receiptSha256: 'e'.repeat(64), overlaps: [{ path: 'src/shared.txt', taskIds: ['builder-a', 'builder-b'] }], pairs: [], reviewCoverage: [] }),
    },
  });
  await assert.rejects(() => service.integrate({
    missionId: f.mission.id,
    principal: { subject: 'user:test' },
    collisionIdempotencyKey: 'integration-preflight',
    verificationCommands: [{ command: process.execPath, args: ['-e', ''] }],
  }), (error) => error.code === 'WORKTREE_INTEGRATION_PREFLIGHT_BLOCKED' && error.collisionMap.receiptSha256 === 'e'.repeat(64));
  assert.equal(approvals, 0);
});
