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

async function fixture(t, stageCommands) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-verification-pyramid-'));
  await exec('git', ['init'], { cwd: root });
  await exec('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.mjs'), 'export const value = 1;\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'baseline'], { cwd: root });
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Verify', status: 'running' });
  const task = store.createTask({
    id: 'builder', projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Verify', role: 'builder', status: 'review', allowedPaths: ['src/**'], leaseOwner: 'worker', fencingToken: 1,
    metadata: {
      verificationPyramid: { stages: [{ kind: 'parse-type', required: true }, { kind: 'security', required: true }] },
      verificationStageCommands: stageCommands,
    },
  });
  const runner = new VerificationRunner({ store, brokerFactory: () => new ToolBroker({ workspaceRoot: root, allowedPaths: ['**'], allowedCommands: ['git', process.execPath] }) });
  return { runner, task };
}

test('fails when a required verification pyramid stage has no executable command', async (t) => {
  const f = await fixture(t, { 'parse-type': [{ command: process.execPath, args: ['-e', 'process.exit(0)'], cwd: '.' }] });
  const report = await f.runner.runTask(f.task.id);
  assert.equal(report.status, 'fail');
  const missing = report.evidence.find((item) => item.kind === 'verification-stage-security');
  assert.equal(missing.status, 'fail');
  assert.match(missing.summary, /no command/i);
});

test('binds passing stage commands to the verification report', async (t) => {
  const pass = [{ command: process.execPath, args: ['-e', 'process.exit(0)'], cwd: '.' }];
  const f = await fixture(t, { 'parse-type': pass, security: pass });
  const report = await f.runner.runTask(f.task.id);
  assert.equal(report.status, 'pass');
  assert.equal(report.evidence.filter((item) => item.kind.startsWith('verification-stage-')).length, 2);
  assert.ok(report.evidence.filter((item) => item.kind.startsWith('verification-stage-')).every((item) => item.status === 'pass'));
});
