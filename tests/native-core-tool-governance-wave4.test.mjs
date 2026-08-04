import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ToolGovernanceRuntime } from '../src/native-core/tool-governance-runtime.mjs';

test('tool governance sanitizes schemas and rejects unsafe URLs and prototype keys', () => {
  const runtime = new ToolGovernanceRuntime({ maxSchemaDepth: 4 });
  const schema = runtime.sanitizeSchema({ type: 'object', properties: { query: { type: 'string', default: 'x', examples: ['x'] }, __proto__: { type: 'string' } }, additionalProperties: false, unsupported: true });
  assert.deepEqual(schema, { type: 'object', properties: { query: { type: 'string', default: 'x' } }, additionalProperties: false });
  assert.equal(runtime.authorizeUrl('https://example.com/path').allowed, true);
  for (const url of ['http://127.0.0.1/x', 'https://localhost/x', 'https://user:pass@example.com/x', 'file:///etc/passwd']) assert.throws(() => runtime.authorizeUrl(url), /unsafe|unsupported|credentials/i);
  assert.equal(runtime.stripAnsi('\u001b[31mred\u001b[0m'), 'red');
});

test('tool governance creates bounded diff/checkpoint receipts and spills oversized output safely', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-tool-governance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtime = new ToolGovernanceRuntime({ workspaceRoot: root, spillRoot: path.join(root, '.nolane-output'), maxInlineBytes: 8, maxDiffBytes: 128 });
  const diff = runtime.prepareWorkingDiff([{ path: 'src/a.mjs', before: 'a', after: 'b' }, { path: '../escape', before: '', after: 'x' }]);
  assert.deepEqual(diff.files.map((entry) => entry.path), ['src/a.mjs']);
  assert.equal(diff.rejected.length, 1);
  assert.match(diff.receiptSha256, /^[a-f0-9]{64}$/);
  const checkpoint = runtime.createCheckpoint({ id: 'cp1', files: diff.files });
  assert.equal(checkpoint.files[0].afterSha256.length, 64);
  const spill = await runtime.captureOutput({ toolCallId: 't1', stdout: '1234567890', stderr: '' });
  assert.equal(spill.inline, false);
  assert.equal(await readFile(spill.path, 'utf8'), '1234567890');
  assert.throws(() => runtime.prepareWorkingDiff([{ path: '.env', before: '', after: 'SECRET=x' }]), /no safe files/i);
});

test('tool governance classifies results and enforces deterministic budgets', () => {
  const runtime = new ToolGovernanceRuntime();
  assert.equal(runtime.classifyResult({ exitCode: 0, stdout: 'ok', stderr: '' }).class, 'success');
  assert.equal(runtime.classifyResult({ exitCode: 124, stdout: '', stderr: 'timeout' }).class, 'timeout');
  assert.equal(runtime.classifyResult({ exitCode: 1, stdout: '', stderr: 'permission denied' }).class, 'permission');
  const budget = runtime.normalizeBudget({ timeoutMs: 5000, maxOutputBytes: 1000, maxProcesses: 2 });
  assert.deepEqual(budget, { timeoutMs: 5000, maxOutputBytes: 1000, maxProcesses: 2 });
  assert.throws(() => runtime.normalizeBudget({ timeoutMs: 0 }), /timeoutMs/);
});
