import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { GitCompletionGovernanceService } from '../src/repository/git-completion-governance-service.mjs';
import { GitGateway } from '../src/repository/git-gateway.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const exec = promisify(execFile);
const principal = Object.freeze({ subject: 'user:test' });
const passReceipt = (suffix = '1') => Object.freeze({ status: 'pass', receiptSha256: suffix.repeat(64).slice(0, 64), command: 'node', args: ['--test'] });

async function git(root, args) { return exec('git', args, { cwd: root }); }

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-git-completion-'));
  const data = await mkdtemp(path.join(os.tmpdir(), 'forge-git-completion-data-'));
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.email', 'forge@example.test']);
  await git(root, ['config', 'user.name', 'Forge Test']);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'app.mjs'), 'export const value = 1;\n');
  await writeFile(path.join(root, '.gitignore'), 'node_modules/\ndist/\ncoverage/\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'chore: baseline']);
  await git(root, ['remote', 'add', 'origin', 'https://example.test/acme/forge.git']);

  const store = new StudioStore(path.join(data, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(data, { recursive: true, force: true }));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Complete governed Git changes', status: 'running' });
  let task = store.createTask({
    id: 'builder', projectId: project.id, missionId: mission.id, title: 'Update application value', objective: 'Change application value and verify tests pass', role: 'builder', status: 'running',
    allowedPaths: ['src/**', 'docs/**'], deniedPaths: ['src/private/**'],
    metadata: { executionWorkspace: root },
  });
  task = store.updateTask(task.id, { metadata: { ...task.metadata, taskContract: { schema: 'forge.task-contract.v1', allowCommit: true } } });
  const gatewayFactory = ({ projectRoot }) => new GitGateway({ repositoryRoot: projectRoot, approval: async () => ({ approved: true, id: 'approval-test' }) });
  const service = new GitCompletionGovernanceService({ store, gatewayFactory });
  return { root, data, store, project, mission, task, service };
}

test('final commit selectively stages allowed files and persists test/risk/remotes evidence', async (t) => {
  const f = await fixture(t);
  const beforeHead = (await git(f.root, ['rev-parse', 'HEAD'])).stdout.trim();
  await writeFile(path.join(f.root, 'src', 'app.mjs'), 'export const value = 2;\n');
  await writeFile(path.join(f.root, 'notes.tmp'), 'must remain untracked\n');

  const result = await f.service.commit({
    taskId: f.task.id,
    principal,
    expectedHead: beforeHead,
    paths: ['src/app.mjs'],
    message: 'fix(builder): update application value',
    testReceipts: [passReceipt('a')],
    residualRisks: ['No cross-platform execution was performed.'],
    idempotencyKey: 'commit-builder-1',
  });

  assert.equal(result.schema, 'forge.git-completion.v1');
  assert.equal(result.kind, 'final');
  assert.notEqual(result.afterHead, beforeHead);
  assert.deepEqual(result.paths, ['src/app.mjs']);
  assert.equal(result.testReceipts[0].status, 'pass');
  assert.deepEqual(result.residualRisks, ['No cross-platform execution was performed.']);
  assert.equal(result.remotes.some((remote) => remote.name === 'origin' && remote.direction === 'fetch'), true);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal((await git(f.root, ['status', '--porcelain=v1'])).stdout.includes('?? notes.tmp'), true);
  assert.equal((await git(f.root, ['show', '--name-only', '--pretty=format:', 'HEAD'])).stdout.trim(), 'src/app.mjs');

  const listed = f.service.listTaskCompletions({ taskId: f.task.id, principal });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].receiptSha256, result.receiptSha256);
  assert.equal(f.store.listEvidence({ taskId: f.task.id }).some((entry) => entry.kind === 'git-completion' && entry.receiptSha256 === result.receiptSha256), true);
  assert.equal(f.store.listEvents().some((entry) => entry.type === 'git.completion.committed' && entry.payload.receiptSha256 === result.receiptSha256), true);
});

test('final commit requires passing verification while checkpoint records pending verification', async (t) => {
  const f = await fixture(t);
  const beforeHead = (await git(f.root, ['rev-parse', 'HEAD'])).stdout.trim();
  await writeFile(path.join(f.root, 'src', 'app.mjs'), 'export const value = 3;\n');

  await assert.rejects(() => f.service.commit({
    taskId: f.task.id, principal, expectedHead: beforeHead, paths: ['src/app.mjs'],
    testReceipts: [], residualRisks: [], idempotencyKey: 'missing-tests',
  }), (error) => error.code === 'GIT_COMPLETION_VERIFICATION_REQUIRED');

  const checkpoint = await f.service.checkpoint({
    taskId: f.task.id, principal, expectedHead: beforeHead, paths: ['src/app.mjs'],
    residualRisks: ['Verification is pending.'], idempotencyKey: 'checkpoint-1',
  });
  assert.equal(checkpoint.kind, 'checkpoint');
  assert.equal(checkpoint.verificationPending, true);
  assert.match(checkpoint.message, /^chore\(builder\): checkpoint /);
});

test('completion rejects secrets, generated artifacts, denied paths, stale HEAD and invalid messages', async (t) => {
  const f = await fixture(t);
  const head = (await git(f.root, ['rev-parse', 'HEAD'])).stdout.trim();
  await writeFile(path.join(f.root, 'src', 'secret.mjs'), 'export const token = "ghp_1234567890abcdefghijklmnop";\n');
  await mkdir(path.join(f.root, 'dist'));
  await writeFile(path.join(f.root, 'dist', 'bundle.js'), 'generated\n');
  await mkdir(path.join(f.root, 'src', 'private'));
  await writeFile(path.join(f.root, 'src', 'private', 'hidden.mjs'), 'hidden\n');

  const base = { taskId: f.task.id, principal, expectedHead: head, testReceipts: [passReceipt('b')], residualRisks: [] };
  await assert.rejects(() => f.service.commit({ ...base, paths: ['src/secret.mjs'], message: 'fix(builder): update secret', idempotencyKey: 'secret' }), (error) => error.code === 'SECRET_SCAN_BLOCKED');
  await assert.rejects(() => f.service.commit({ ...base, paths: ['dist/bundle.js'], message: 'build(builder): add bundle', idempotencyKey: 'artifact' }), (error) => error.code === 'GIT_COMPLETION_ARTIFACT_DENIED');
  await assert.rejects(() => f.service.commit({ ...base, paths: ['src/private/hidden.mjs'], message: 'fix(builder): edit private file', idempotencyKey: 'denied' }), (error) => error.code === 'GIT_COMPLETION_PATH_DENIED');
  await assert.rejects(() => f.service.commit({ ...base, paths: ['src/app.mjs'], expectedHead: '0'.repeat(40), message: 'fix(builder): stale head', idempotencyKey: 'stale' }), (error) => error.code === 'GIT_HEAD_MISMATCH');
  await assert.rejects(() => f.service.commit({ ...base, paths: ['src/app.mjs'], message: 'not conventional', idempotencyKey: 'message' }), (error) => error.code === 'GIT_COMPLETION_MESSAGE_INVALID');
});

test('idempotency returns the original receipt and rejects key reuse with a different request', async (t) => {
  const f = await fixture(t);
  const head = (await git(f.root, ['rev-parse', 'HEAD'])).stdout.trim();
  await writeFile(path.join(f.root, 'src', 'app.mjs'), 'export const value = 4;\n');
  const input = {
    taskId: f.task.id, principal, expectedHead: head, paths: ['src/app.mjs'],
    message: 'fix(builder): persist idempotent completion', testReceipts: [passReceipt('c')], residualRisks: [], idempotencyKey: 'stable-key',
  };
  const first = await f.service.commit(input);
  const second = await f.service.commit(input);
  assert.equal(second.receiptSha256, first.receiptSha256);
  await assert.rejects(() => f.service.commit({ ...input, residualRisks: ['Different request'] }), (error) => error.code === 'GIT_COMPLETION_IDEMPOTENCY_MISMATCH');
});

async function collisionFixture(t, { conflicting = true, reviewed = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-git-collision-'));
  const data = await mkdtemp(path.join(os.tmpdir(), 'forge-git-collision-data-'));
  const cleanup = async () => {
    await git(root, ['worktree', 'prune']).catch(() => {});
    await rm(root, { recursive: true, force: true });
    await rm(data, { recursive: true, force: true });
  };
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.email', 'forge@example.test']);
  await git(root, ['config', 'user.name', 'Forge Test']);
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'shared.txt'), 'base\n');
  await writeFile(path.join(root, 'src', 'a.txt'), 'base-a\n');
  await writeFile(path.join(root, 'src', 'b.txt'), 'base-b\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'chore: baseline']);

  const worktrees = path.join(data, 'worktrees');
  await mkdir(worktrees);
  const aPath = path.join(worktrees, 'a');
  const bPath = path.join(worktrees, 'b');
  await git(root, ['worktree', 'add', '-b', 'forge/a', aPath, 'main']);
  await git(root, ['worktree', 'add', '-b', 'forge/b', bPath, 'main']);
  await writeFile(path.join(aPath, 'src', 'a.txt'), 'changed-a\n');
  if (conflicting) await writeFile(path.join(aPath, 'src', 'shared.txt'), 'from-a\n');
  await git(aPath, ['add', '.']);
  await git(aPath, ['commit', '-m', 'feat(a): change files']);
  await writeFile(path.join(bPath, 'src', 'b.txt'), 'changed-b\n');
  if (conflicting) await writeFile(path.join(bPath, 'src', 'shared.txt'), 'from-b\n');
  await git(bPath, ['add', '.']);
  await git(bPath, ['commit', '-m', 'feat(b): change files']);

  const store = new StudioStore(path.join(data, 'studio.db'));
  t.after(() => store.close());
  t.after(cleanup);
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  let mission = store.createMission({ projectId: project.id, objective: 'Integrate agent worktrees', status: 'running' });
  const a = store.createTask({ id: 'a', projectId: project.id, missionId: mission.id, title: 'A', objective: 'Change A', role: 'builder', status: 'done', allowedPaths: ['src/**'], metadata: { executionWorkspace: aPath, worktree: { path: aPath, branch: 'forge/a', baseRef: 'main' } } });
  const b = store.createTask({ id: 'b', projectId: project.id, missionId: mission.id, title: 'B', objective: 'Change B', role: 'builder', status: 'done', allowedPaths: ['src/**'], metadata: { executionWorkspace: bPath, worktree: { path: bPath, branch: 'forge/b', baseRef: 'main' } } });
  const changed = conflicting ? { a: ['src/a.txt', 'src/shared.txt'], b: ['src/b.txt', 'src/shared.txt'] } : { a: ['src/a.txt'], b: ['src/b.txt'] };
  const decisions = {};
  if (reviewed) {
    for (const [taskId, paths] of Object.entries(changed)) for (const relative of paths) {
      decisions[`${taskId}:${relative}`] = { taskId, path: relative, decision: 'accept', actor: principal.subject, receiptSha256: 'd'.repeat(64) };
    }
  }
  mission = store.updateMission(mission.id, { metadata: { ...mission.metadata, gitReviewDecisions: decisions } });
  const gatewayFactory = ({ projectRoot }) => new GitGateway({ repositoryRoot: projectRoot, approval: async () => ({ approved: true, id: 'approval-test' }) });
  const service = new GitCompletionGovernanceService({ store, gatewayFactory });
  return { root, data, store, project, mission, a, b, service };
}

test('collision map tracks agent changes, duplicate files and non-mutating merge-tree conflicts', async (t) => {
  const f = await collisionFixture(t, { conflicting: true, reviewed: true });
  const beforeA = (await git(f.a.metadata.worktree.path, ['rev-parse', 'HEAD'])).stdout.trim();
  const beforeB = (await git(f.b.metadata.worktree.path, ['rev-parse', 'HEAD'])).stdout.trim();
  const map = await f.service.collisionMap({ missionId: f.mission.id, principal, targetRef: 'main', idempotencyKey: 'collision-1' });
  assert.equal(map.schema, 'forge.git-collision-map.v1');
  assert.deepEqual(map.tasks.map((task) => task.taskId), ['a', 'b']);
  assert.deepEqual(map.overlaps, [{ path: 'src/shared.txt', taskIds: ['a', 'b'] }]);
  assert.equal(map.pairs.length, 1);
  assert.equal(map.pairs[0].status, 'conflict');
  assert.equal(map.pairs[0].conflictPaths.includes('src/shared.txt'), true);
  assert.equal(map.reviewCoverage.every((entry) => entry.status === 'accepted'), true);
  assert.equal(map.ready, false);
  assert.match(map.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal((await git(f.a.metadata.worktree.path, ['rev-parse', 'HEAD'])).stdout.trim(), beforeA);
  assert.equal((await git(f.b.metadata.worktree.path, ['rev-parse', 'HEAD'])).stdout.trim(), beforeB);
  assert.equal(f.store.listEvents().some((event) => event.type === 'git.collision-map.created'), true);
});

test('collision map becomes integration-ready only when worktrees are clean, conflict-free and every changed path is accepted', async (t) => {
  const clean = await collisionFixture(t, { conflicting: false, reviewed: true });
  const ready = await clean.service.collisionMap({ missionId: clean.mission.id, principal, targetRef: 'main', idempotencyKey: 'ready' });
  assert.equal(ready.overlaps.length, 0);
  assert.equal(ready.pairs[0].status, 'clean');
  assert.equal(ready.reviewCoverage.every((entry) => entry.status === 'accepted'), true);
  assert.equal(ready.ready, true);

  const pending = await collisionFixture(t, { conflicting: false, reviewed: false });
  const blocked = await pending.service.collisionMap({ missionId: pending.mission.id, principal, targetRef: 'main', idempotencyKey: 'pending' });
  assert.equal(blocked.reviewCoverage.every((entry) => entry.status === 'pending'), true);
  assert.equal(blocked.ready, false);
  assert.equal(pending.service.getMissionCollisionMap({ missionId: pending.mission.id, principal }).receiptSha256, blocked.receiptSha256);
});

test('conflict resolution receipt is issued only after the original merge-tree conflict is gone and tests pass', async (t) => {
  const f = await collisionFixture(t, { conflicting: true, reviewed: true });
  const conflicted = await f.service.collisionMap({ missionId: f.mission.id, principal, targetRef: 'main', idempotencyKey: 'resolution-before' });
  assert.equal(conflicted.pairs[0].status, 'conflict');

  const input = {
    missionId: f.mission.id,
    leftTaskId: 'a',
    rightTaskId: 'b',
    principal,
    expectedConflictReceiptSha256: conflicted.receiptSha256,
    resolutionSummary: 'Kept the shared-file implementation from agent A and rebased agent B to the base version.',
    testReceipts: [passReceipt('e')],
    idempotencyKey: 'resolve-shared',
  };
  await assert.rejects(() => f.service.recordConflictResolution(input), (error) => error.code === 'GIT_CONFLICT_STILL_PRESENT');

  await git(f.b.metadata.worktree.path, ['checkout', 'main', '--', 'src/shared.txt']);
  await git(f.b.metadata.worktree.path, ['commit', '-am', 'fix(b): resolve shared conflict']);
  const resolved = await f.service.recordConflictResolution({ ...input, idempotencyKey: 'resolve-shared-after-fix' });
  assert.equal(resolved.schema, 'forge.git-conflict-resolution.v1');
  assert.deepEqual(resolved.taskIds, ['a', 'b']);
  assert.deepEqual(resolved.resolvedPaths, ['src/shared.txt']);
  assert.equal(resolved.testReceipts[0].status, 'pass');
  assert.match(resolved.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(f.store.listEvidence({ projectId: f.project.id }).some((entry) => entry.kind === 'git-conflict-resolution' && entry.receiptSha256 === resolved.receiptSha256), true);
  assert.equal(f.store.listEvents().some((event) => event.type === 'git.conflict.resolved'), true);

  const repeated = await f.service.recordConflictResolution({ ...input, idempotencyKey: 'resolve-shared-after-fix' });
  assert.equal(repeated.receiptSha256, resolved.receiptSha256);
});
