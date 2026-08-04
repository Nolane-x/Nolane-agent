import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-process-contract-')); t.after(() => rm(root, { recursive: true, force: true }));
  return new ToolBroker({ workspaceRoot: root, allowedCommands: [process.execPath], timeoutMs: 1000, maxOutputBytes: 4096 });
}

test('process lifecycle returns stdout stderr exit code duration and bounded stdin', async (t) => {
  const broker = await fixture(t);
  const result = await broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{console.log(s.toUpperCase());console.error('warn')})"], stdin: 'hello' } });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.exitCode, 0);
  assert.equal(result.output.stdout.trim(), 'HELLO');
  assert.equal(result.output.stderr.trim(), 'warn');
  assert.equal(result.output.args.includes('hello'), false);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('process lifecycle rejects non-allowlisted commands and kills timeouts', async (t) => {
  const broker = await fixture(t);
  await assert.rejects(() => broker.execute({ tool: 'process.run', input: { command: 'definitely-not-allowed', args: [] } }), /not allowed|allowlist/i);
  const result = await broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', 'setTimeout(()=>{},5000)'], timeoutMs: 20 } });
  assert.equal(result.output.timedOut, true);
  assert.notEqual(result.output.exitCode, 0);
});
