import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ExecutionBackendRegistry } from '../src/native-core/execution-backend-registry.mjs';
import { ToolExecutionFabric } from '../src/native-core/tool-execution-fabric.mjs';
import { ToolRegistry } from '../src/nolane-native/tool-registry.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

const hex64 = /^[a-f0-9]{64}$/;

test('execution backend registry rejects duplicates and exposes secret-free capability schemas', () => {
  const registry = new ExecutionBackendRegistry();
  registry.register({ id: 'local', kind: 'local-process', capabilities: ['process'], available: () => true, execute: async () => ({ exitCode: 0 }) });
  assert.throws(() => registry.register({ id: 'local', kind: 'local-process', capabilities: [], execute: async () => ({}) }), /duplicate/i);
  assert.deepEqual(registry.describe(), [{ id: 'local', kind: 'local-process', capabilities: ['process'], available: true }]);
});

test('tool execution fabric normalizes output, enforces approval and records resource receipts', async () => {
  const registry = new ExecutionBackendRegistry();
  registry.register({ id: 'local', kind: 'local-process', capabilities: ['process'], execute: async ({ args }) => ({ stdout: args.join(' '), stderr: '', exitCode: 0, resourceUsage: { peakRssBytes: 1024 } }) });
  const fabric = new ToolExecutionFabric({ registry, clock: (() => { let n = 10; return () => ++n; })() });
  await assert.rejects(() => fabric.execute({ backendId: 'local', action: { args: ['danger'] }, policy: { risk: 'high', reversible: false, approved: false } }), /approval required/i);
  const result = await fabric.execute({ backendId: 'local', action: { args: ['hello', 'world'] }, policy: { risk: 'low', reversible: true } });
  assert.equal(result.status, 'pass');
  assert.equal(result.stdout, 'hello world');
  assert.equal(result.exitCode, 0);
  assert.equal(result.resourceReceipt.peakRssBytes, 1024);
  assert.equal(result.approvalReceipt.required, false);
  assert.match(result.receiptSha256, hex64);
});

test('tool execution fabric aborts timed out work and runs backend cleanup once', async () => {
  const registry = new ExecutionBackendRegistry();
  let cleanupCalls = 0;
  registry.register({
    id: 'slow', kind: 'container', capabilities: ['process'],
    execute: async ({ signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' })), { once: true })),
    cleanup: async () => { cleanupCalls += 1; },
  });
  const fabric = new ToolExecutionFabric({ registry });
  const result = await fabric.execute({ backendId: 'slow', action: {}, timeoutMs: 20, policy: { risk: 'low', reversible: true } });
  assert.equal(result.status, 'timeout');
  assert.equal(result.errorClass, 'timeout');
  assert.equal(cleanupCalls, 1);
});

test('tool execution fabric reports unavailable SSH and Windows contracts without pretending execution', async () => {
  const registry = new ExecutionBackendRegistry();
  registry.register({ id: 'ssh', kind: 'ssh', capabilities: ['remote'], available: () => false, execute: async () => ({ exitCode: 0 }) });
  registry.register({ id: 'windows-job', kind: 'windows-job', capabilities: ['process'], available: () => false, execute: async () => ({ exitCode: 0 }) });
  const fabric = new ToolExecutionFabric({ registry });
  await assert.rejects(() => fabric.execute({ backendId: 'ssh', action: {} }), (error) => error.code === 'BACKEND_UNAVAILABLE');
  await assert.rejects(() => fabric.execute({ backendId: 'windows-job', action: {} }), (error) => error.code === 'BACKEND_UNAVAILABLE');
});

test('ToolRegistry routes backend tools through the execution fabric', async () => {
  const backends = new ExecutionBackendRegistry();
  backends.register({ id: 'local', kind: 'local-process', capabilities: ['process'], execute: async ({ input }) => ({ stdout: input.text, stderr: '', exitCode: 0 }) });
  const tools = new ToolRegistry({ executionFabric: new ToolExecutionFabric({ registry: backends }) });
  tools.register({ name: 'echo', capability: 'shell:execute', risk: 'low', reversible: true, backendId: 'local', toAction: (input) => ({ input }) });
  const result = await tools.execute('echo', { text: 'ok' }, { grantedCapabilities: ['shell:execute'], approvals: [] });
  assert.equal(result.output.stdout, 'ok');
  assert.match(result.output.receiptSha256, hex64);
});

test('ToolBroker production path returns its existing tool receipt plus a native execution receipt', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-native-tool-broker-'));
  try {
    await writeFile(path.join(root, 'a.txt'), 'hello');
    const broker = new ToolBroker({ workspaceRoot: root });
    const result = await broker.execute({ tool: 'fs.read', input: { path: 'a.txt' } });
    assert.equal(result.status, 'pass');
    assert.match(result.receipt.receiptSha256, hex64);
    assert.match(result.executionReceipt.receiptSha256, hex64);
    assert.equal(result.executionReceipt.backendId, 'tool-broker');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
