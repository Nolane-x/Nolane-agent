import test from 'node:test';
import assert from 'node:assert/strict';

import { AutonomyGuardedBroker, classifyCommand } from '../src/security/autonomy-guarded-broker.mjs';
import { AutonomyPolicy } from '../src/security/autonomy-policy.mjs';

function fixture({ profile = 'workspace-autopilot', worktree = true } = {}) {
  const calls = [];
  const task = { id: 'task-1', projectId: 'project-1', metadata: worktree ? { worktree: { path: '/managed/task-1' } } : {} };
  const store = { getAutonomyGrant() { return { profile, scope: { network: 'deny' } }; } };
  const broker = { async execute(request, context) { calls.push([request, context]); return { status: 'pass', output: {}, receipt: { receiptSha256: 'a'.repeat(64) } }; } };
  return { calls, task, guarded: new AutonomyGuardedBroker({ broker, policy: new AutonomyPolicy(), store, task }) };
}

test('command classifier recognizes bounded development and read-only git commands', () => {
  assert.deepEqual(classifyCommand({ command: 'git', args: ['status', '--short'] }), { commandClass: 'git-read', readOnly: true, gitOperation: 'status' });
  assert.deepEqual(classifyCommand({ command: 'git', args: ['commit', '-m', 'safe'] }), { commandClass: 'git', readOnly: false, gitOperation: 'commit' });
  assert.deepEqual(classifyCommand({ command: 'npm', args: ['test'] }), { commandClass: 'test', readOnly: false });
  assert.deepEqual(classifyCommand({ command: 'node', args: ['--test'] }), { commandClass: 'test', readOnly: false });
  assert.deepEqual(classifyCommand({ command: 'npm', args: ['run', 'build'] }), { commandClass: 'build', readOnly: false });
  assert.deepEqual(classifyCommand({ command: 'npm', args: ['install'] }), { commandClass: 'dependency-install', readOnly: false });
});

test('workspace autopilot runs reversible worktree changes without prompting', async () => {
  const f = fixture();
  await f.guarded.execute({ tool: 'fs.patch', input: { patch: 'x' } }, { refs: { taskId: f.task.id } });
  await f.guarded.execute({ tool: 'process.run', input: { command: 'npm', args: ['test'] } }, { refs: { taskId: f.task.id } });
  assert.equal(f.calls.length, 2);
});

test('workspace autopilot allows read-only git inspection outside a worktree but blocks writes and network installs', async () => {
  const f = fixture({ worktree: false });
  await f.guarded.execute({ tool: 'process.run', input: { command: 'git', args: ['status', '--short'] } });
  await assert.rejects(() => f.guarded.execute({ tool: 'fs.write', input: { path: 'src/a.mjs', content: 'x' } }), (error) => error.code === 'AUTONOMY_APPROVAL_REQUIRED');

  const managed = fixture();
  await assert.rejects(() => managed.guarded.execute({ tool: 'process.run', input: { command: 'npm', args: ['install'] } }), (error) => error.code === 'AUTONOMY_APPROVAL_REQUIRED');
});

test('guided mode keeps state changes behind an approval boundary', async () => {
  const f = fixture({ profile: 'guided' });
  await f.guarded.execute({ tool: 'fs.read', input: { path: 'src/a.mjs' } });
  await assert.rejects(() => f.guarded.execute({ tool: 'process.run', input: { command: 'npm', args: ['test'] } }), (error) => error.code === 'AUTONOMY_APPROVAL_REQUIRED');
  assert.equal(f.calls.length, 1);
});
