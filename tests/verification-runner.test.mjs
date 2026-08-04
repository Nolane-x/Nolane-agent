import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { VerificationRunner } from '../src/orchestration/verification-runner.mjs';

const exec = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-verification-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec('git', ['init'], { cwd: root });
  await exec('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.mjs'), 'export const value = 1;\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'baseline'], { cwd: root });

  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Change', status: 'running' });
  const task = store.createTask({
    id: 'builder', projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Change value', role: 'builder', status: 'review',
    allowedPaths: ['src/**'], leaseOwner: 'worker', fencingToken: 1,
    metadata: { executionWorkspace: root, verificationCommands: [{ command: process.execPath, args: ['-e', 'process.exit(0)'], cwd: '.' }] },
  });
  const brokerFactory = () => new ToolBroker({ workspaceRoot: root, allowedPaths: ['**'], allowedCommands: ['git', process.execPath] });
  return { root, store, task, runner: new VerificationRunner({ store, brokerFactory }) };
}

test('VerificationRunner binds passing command receipts to the current commit and repository diff', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'src', 'a.mjs'), 'export const value = 2;\n');
  const report = await f.runner.runTask(f.task.id);
  assert.equal(report.status, 'pass');
  assert.equal(report.evidence.length, 2);
  assert.ok(report.evidence.every((item) => item.status === 'pass'));
  assert.ok(report.evidence.every((item) => /^[a-f0-9]{64}$/.test(item.artifactSha256)));
  assert.ok(report.evidence.every((item) => /^[a-f0-9]{64}$/.test(item.receiptSha256)));
  assert.match(report.commit, /^[a-f0-9]{40,64}$/);
  assert.ok(report.diffBytes > 0);
});

test('VerificationRunner reports a failed verification command without manufacturing passing evidence', async (t) => {
  const f = await fixture(t);
  f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, verificationCommands: [{ command: process.execPath, args: ['-e', 'process.exit(7)'], cwd: '.' }] } });
  const report = await f.runner.runTask(f.task.id);
  assert.equal(report.status, 'fail');
  assert.equal(report.evidence.at(-1).status, 'fail');
  assert.equal(report.evidence.some((item) => item.status === 'pass' && item.kind === 'verification-command'), false);
});

test('VerificationRunner binds required environment health receipts to the candidate verification report', async (t) => {
  const f = await fixture(t);
  f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, environmentRequirements: [{ id: 'web', allowedStates: ['healthy'] }] } });
  const environmentService = {
    async status(id, input) {
      assert.equal(id, 'web');
      assert.equal(input.projectId, f.task.projectId);
      return { id, projectId: input.projectId, state: 'healthy', receiptSha256: 'c'.repeat(64), lastHealth: { expected: true } };
    },
  };
  const runner = new VerificationRunner({ store: f.store, brokerFactory: () => new ToolBroker({ workspaceRoot: f.root, allowedPaths: ['**'], allowedCommands: ['git', process.execPath] }), environmentService });
  const report = await runner.runTask(f.task.id);
  const evidence = report.evidence.find((item) => item.kind === 'environment-health');
  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.payload.environmentReceiptSha256, 'c'.repeat(64));
});
