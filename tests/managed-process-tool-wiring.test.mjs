import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { CORE_TOOL_SCHEMAS } from '../src/agent/agent-loop.mjs';
import { AutonomyPolicy } from '../src/security/autonomy-policy.mjs';
import { AutonomyGuardedBroker } from '../src/security/autonomy-guarded-broker.mjs';

function schema(name) {
  return CORE_TOOL_SCHEMAS.find((item) => item.function.name === name);
}

test('agent exposes bounded managed-process lifecycle schemas', () => {
  const start = schema('process.startManaged');
  const stop = schema('process.stopManaged');
  const list = schema('process.listManaged');
  assert.ok(start);
  assert.ok(stop);
  assert.ok(list);
  assert.deepEqual(start.function.parameters.required, ['id', 'command', 'args']);
  assert.equal(start.function.parameters.properties.commandClass.const, 'dev-server');
  assert.equal(start.function.parameters.properties.args.maxItems, 128);
  assert.deepEqual(stop.function.parameters.required, ['id']);
  assert.equal(list.function.parameters.additionalProperties, false);
});

test('autonomy policy treats managed start as a governed development command and list as read-only', () => {
  const policy = new AutonomyPolicy();
  const context = { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true };
  assert.equal(policy.evaluate({ kind: 'process.startManaged', commandClass: 'dev-server' }, context).decision, 'allow');
  assert.equal(policy.evaluate({ kind: 'process.stopManaged' }, context).decision, 'allow');
  assert.equal(policy.evaluate({ kind: 'process.listManaged' }, { profile: 'guided', withinWorkspace: true }).decision, 'allow');
  assert.notEqual(policy.evaluate({ kind: 'process.startManaged', commandClass: 'arbitrary' }, context).decision, 'allow');
});

test('autonomy guarded broker classifies and forwards managed-process tools', async () => {
  const calls = [];
  const task = { id: 'task-1', projectId: 'project-1', metadata: { worktree: { path: '/managed/task-1' } } };
  const store = { getAutonomyGrant() { return { profile: 'workspace-autopilot', scope: { network: 'deny' } }; } };
  const broker = { async execute(request, context) { calls.push([request, context]); return { status: 'pass', output: {}, receipt: { receiptSha256: 'a'.repeat(64) } }; } };
  const guarded = new AutonomyGuardedBroker({ broker, policy: new AutonomyPolicy(), store, task });
  await guarded.execute({ tool: 'process.startManaged', input: { id: 'dev', command: 'npm', args: ['run', 'dev'], commandClass: 'dev-server' } });
  await guarded.execute({ tool: 'process.listManaged', input: {} });
  await guarded.execute({ tool: 'process.stopManaged', input: { id: 'dev' } });
  assert.deepEqual(calls.map(([request]) => request.tool), ['process.startManaged', 'process.listManaged', 'process.stopManaged']);
});

test('application wires command governance into task brokers and agent calls carry principal-bound context', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const loop = await readFile(new URL('../src/agent/agent-loop.mjs', import.meta.url), 'utf8');
  assert.match(app, /new ApprovalBundleService/);
  assert.match(app, /new CommandExecutionGovernanceService/);
  assert.match(app, /commandGovernance:\s*commandExecutionGovernance/);
  assert.match(loop, /principalId:\s*`agent:\$\{task\.id\}`/);
  assert.match(loop, /projectId:\s*task\.projectId/);
  assert.match(loop, /taskId:\s*task\.id/);
  assert.match(loop, /sessionId:\s*run\.id/);
});
