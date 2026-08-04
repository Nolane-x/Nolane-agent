import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ToolBroker } from '../src/execution/tool-broker.mjs';

async function fixture(t, commandGovernance) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-command-governance-'));
  const broker = new ToolBroker({ workspaceRoot: root, allowedCommands: [process.execPath], commandGovernance, timeoutMs: 1_000 });
  t.after(async () => { await broker.close(); await rm(root, { recursive: true, force: true }); });
  return { root, broker };
}

const context = { principalId: 'agent:t1', projectId: 'p1', taskId: 't1', sessionId: 'run-1', origin: 'agent' };

test('governance denial happens before spawn and allow receipt is linked to tool output', async (t) => {
  let calls = 0;
  const denied = { authorize() { calls += 1; const error = new Error('denied'); error.code = 'COMMAND_APPROVAL_REQUIRED'; throw error; } };
  const { broker } = await fixture(t, denied);
  await assert.rejects(() => broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', 'process.exit(0)'] } }, context), /denied/);
  assert.equal(calls, 1);

  const allowReceipt = Object.freeze({ decision: 'allow', receiptSha256: 'a'.repeat(64), categories: [] });
  broker.commandGovernance = { authorize() { return allowReceipt; } };
  const result = await broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', "console.log('ok')"] } }, context);
  assert.equal(result.status, 'pass');
  assert.equal(result.output.governanceReceiptSha256, allowReceipt.receiptSha256);
});

test('process.run rejects dev servers and managed tools own the PID lifecycle', async (t) => {
  const { broker } = await fixture(t, { authorize() { return { decision: 'allow', receiptSha256: 'b'.repeat(64), categories: [] }; } });
  await assert.rejects(() => broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], commandClass: 'dev-server' } }, context), /startManaged/i);
  const started = await broker.execute({ tool: 'process.startManaged', input: { id: 'dev', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], commandClass: 'dev-server', startupDelayMs: 20 } }, context);
  assert.equal(started.status, 'pass');
  assert.ok(started.output.pid > 0);
  assert.equal(started.output.governanceReceiptSha256, 'b'.repeat(64));
  const listed = await broker.execute({ tool: 'process.listManaged', input: {} }, context);
  assert.equal(listed.output.items.length, 1);
  assert.equal(listed.output.items[0].id, 'dev');
  const stopped = await broker.execute({ tool: 'process.stopManaged', input: { id: 'dev' } }, context);
  assert.equal(stopped.output.state, 'exited');
  assert.equal((await broker.execute({ tool: 'process.listManaged', input: {} }, context)).output.items.length, 0);
});

test('managed server ID is unique and broker close cleans up running servers', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-command-close-'));
  const broker = new ToolBroker({ workspaceRoot: root, allowedCommands: [process.execPath], commandGovernance: { authorize() { return { decision: 'allow', receiptSha256: 'c'.repeat(64), categories: [] }; } } });
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await broker.execute({ tool: 'process.startManaged', input: { id: 'server', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], commandClass: 'dev-server', startupDelayMs: 20 } }, context);
  await assert.rejects(() => broker.execute({ tool: 'process.startManaged', input: { id: 'server', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], commandClass: 'dev-server' } }, context), /already managed/i);
  await broker.close();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.throws(() => process.kill(first.output.pid, 0));
});
