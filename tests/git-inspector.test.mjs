import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { GitInspector } from '../src/repository/git-inspector.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

const exec = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-git-inspector-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec('git', ['init'], { cwd: root });
  await exec('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await writeFile(path.join(root, 'a.txt'), 'one\n');
  await exec('git', ['add', 'a.txt'], { cwd: root });
  await exec('git', ['commit', '-m', 'initial'], { cwd: root });
  await writeFile(path.join(root, 'a.txt'), 'one\ntwo\n');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Edit', objective: 'Edit a.txt', metadata: { executionWorkspace: root } });
  const inspector = new GitInspector({
    store,
    brokerFactory: () => new ToolBroker({ workspaceRoot: root, allowedPaths: ['**'], allowedCommands: ['git'], maxOutputBytes: 200_000 }),
  });
  return { inspector, project, task, store, root };
}

test('GitInspector returns a bounded content-addressed snapshot through the governed broker', async (t) => {
  const f = await fixture(t);
  const snapshot = await f.inspector.snapshot({ projectId: f.project.id, taskId: f.task.id });
  assert.match(snapshot.head, /^[a-f0-9]{40,64}$/);
  assert.equal(snapshot.dirty, true);
  assert.ok(snapshot.status.some((entry) => entry.path === 'a.txt' && entry.code.includes('M')));
  assert.match(snapshot.diff, /\+two/);
  assert.match(snapshot.snapshotSha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.receipts.length, 5);
  assert.ok(snapshot.receipts.every((receipt) => /^[a-f0-9]{64}$/.test(receipt.receiptSha256)));
});

test('GitInspector rejects a task that does not belong to the requested project', async (t) => {
  const f = await fixture(t);
  const other = f.store.createProject({ name: 'Other', workspaceRoot: f.root });
  await assert.rejects(() => f.inspector.snapshot({ projectId: other.id, taskId: f.task.id }), /does not belong/i);
});
