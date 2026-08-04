import test from 'node:test';
import assert from 'node:assert/strict';
import { GitInspector } from '../src/repository/git-inspector.mjs';

function result(stdout, suffix) { return { status: 'pass', output: { stdout, stderr: '', truncated: false }, receipt: { receiptSha256: suffix.repeat(64) } }; }

test('git workspace governance contract records immutable branch status diff and receipts', async () => {
  const project = { id: 'p1', workspaceRoot: '/repo' };
  const outputs = [result('a'.repeat(40) + '\n', '1'), result('main\n', '2'), result(' M src/app.mjs\n', '3'), result(' 1 file changed\n', '4'), result('diff --git a/src/app.mjs b/src/app.mjs\n', '5')];
  let index = 0;
  const inspector = new GitInspector({ store: { getProject: (id) => id === 'p1' ? project : null, getTask: () => null }, brokerFactory: () => ({ execute: async () => outputs[index++] }) });
  const snapshot = await inspector.snapshot({ projectId: 'p1' });
  assert.equal(snapshot.branch, 'main');
  assert.equal(snapshot.dirty, true);
  assert.equal(snapshot.status[0].path, 'src/app.mjs');
  assert.equal(snapshot.receiptHashes.length, 5);
  assert.match(snapshot.snapshotSha256, /^[a-f0-9]{64}$/);
});

test('git workspace governance contract rejects unknown projects cross-project tasks and failed git commands', async () => {
  const projects = { p1: { id: 'p1', workspaceRoot: '/repo' }, p2: { id: 'p2', workspaceRoot: '/other' } };
  const store = { getProject: (id) => projects[id] ?? null, getTask: (id) => id === 't1' ? { id, projectId: 'p2', metadata: {} } : null };
  const inspector = new GitInspector({ store, brokerFactory: () => ({ execute: async () => ({ status: 'fail', output: { stdout: '', stderr: 'denied' }, receipt: { receiptSha256: 'f'.repeat(64) } }) }) });
  await assert.rejects(() => inspector.snapshot({ projectId: 'missing' }), /unknown project/i);
  await assert.rejects(() => inspector.snapshot({ projectId: 'p1', taskId: 't1' }), /does not belong/i);
  await assert.rejects(() => inspector.snapshot({ projectId: 'p1' }), /git rev-parse failed/i);
});
