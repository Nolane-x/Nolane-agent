import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { redactSecrets } from '../src/security/redaction.mjs';
import { WorkspacePolicy } from '../src/security/path-policy.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-broker-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.txt'), 'alpha\nbeta\n', 'utf8');
  const broker = new ToolBroker({
    workspaceRoot: root,
    allowedCommands: [process.execPath],
    allowedEnv: ['FORGE_TEST_VISIBLE'],
    timeoutMs: 500,
    maxOutputBytes: 2_048,
  });
  return { root, broker };
}

test('redactSecrets recursively removes common credentials and provided secret values', () => {
  const payload = {
    apiKey: 'sk-abcdefghijklmnopqrstuvwxyz123456',
    auth: 'Bearer abcdefghijklmnopqrstuvwxyz',
    nested: ['safe', 'custom-secret-value'],
  };
  const redacted = redactSecrets(payload, { secretValues: ['custom-secret-value'] });
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.auth, 'Bearer [REDACTED]');
  assert.equal(redacted.nested[0], 'safe');
  assert.equal(redacted.nested[1], '[REDACTED]');
  assert.equal(payload.nested[1], 'custom-secret-value');
});

test('WorkspacePolicy rejects traversal and symlink escape for reads and writes', async (t) => {
  const { root } = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'forge-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, 'secret.txt'), 'hidden', 'utf8');
  await symlink(outside, path.join(root, 'escape'), 'dir');
  const policy = new WorkspacePolicy(root);
  await assert.rejects(() => policy.resolveRead('../outside.txt'), /escapes workspace/i);
  await assert.rejects(() => policy.resolveRead('escape/secret.txt'), /symlink/i);
  await assert.rejects(() => policy.resolveWrite('escape/new.txt'), /symlink/i);
  assert.equal(await policy.resolveRead('src/a.txt'), path.join(root, 'src', 'a.txt'));
});

test('ToolBroker reads and atomically writes with expected hashes and content-addressed receipts', async (t) => {
  const { root, broker } = await fixture(t);
  const read = await broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt' } });
  assert.equal(read.status, 'pass');
  assert.equal(read.output.content, 'alpha\nbeta\n');
  assert.match(read.receipt.receiptSha256, /^[a-f0-9]{64}$/);

  await assert.rejects(() => broker.execute({ tool: 'fs.write', input: { path: 'src/a.txt', content: 'changed', expectedSha256: '0'.repeat(64) } }), /hash mismatch/i);
  const originalHash = canonicalSha256('alpha\nbeta\n');
  const write = await broker.execute({ tool: 'fs.write', input: { path: 'src/a.txt', content: 'changed\n', expectedSha256: originalHash } });
  assert.equal(write.status, 'pass');
  assert.equal(await readFile(path.join(root, 'src', 'a.txt'), 'utf8'), 'changed\n');
  assert.equal(write.output.afterSha256, canonicalSha256('changed\n'));
});

test('ToolBroker process runner uses argv, filters env, truncates output, and rejects commands', async (t) => {
  const { broker } = await fixture(t);
  const result = await broker.execute({
    tool: 'process.run',
    input: {
      command: process.execPath,
      args: ['-e', "console.log(process.env.FORGE_TEST_VISIBLE); console.log(process.env.FORGE_TEST_SECRET); console.log('x'.repeat(4000))"],
      env: { FORGE_TEST_VISIBLE: 'visible', FORGE_TEST_SECRET: 'secret' },
    },
  });
  assert.equal(result.status, 'pass');
  assert.match(result.output.stdout, /visible/);
  assert.doesNotMatch(result.output.stdout, /secret/);
  assert.equal(result.output.truncated, true);
  assert.ok(Buffer.byteLength(result.output.stdout) <= 2_048);
  await assert.rejects(() => broker.execute({ tool: 'process.run', input: { command: 'rm', args: ['-rf', '.'] } }), /allowlisted/i);
});

test('ToolBroker times out and kills a long-running process', async (t) => {
  const { broker } = await fixture(t);
  const result = await broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', 'setTimeout(()=>{}, 10000)'], timeoutMs: 50 } });
  assert.equal(result.status, 'timeout');
  assert.equal(result.output.timedOut, true);
});

test('ToolBroker enforces task path ownership for reads, writes, patches, and process cwd', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-owned-paths-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src', 'secrets'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'src', 'feature.txt'), 'old\n', 'utf8');
  await writeFile(path.join(root, 'src', 'secrets', 'token.txt'), 'hidden\n', 'utf8');
  await writeFile(path.join(root, 'tests', 'feature.test.txt'), 'test\n', 'utf8');

  const broker = new ToolBroker({
    workspaceRoot: root,
    allowedPaths: ['src/**'],
    deniedPaths: ['src/secrets/**'],
    allowedCommands: [process.execPath],
  });

  assert.equal((await broker.execute({ tool: 'fs.read', input: { path: 'src/feature.txt' } })).status, 'pass');
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: 'tests/feature.test.txt' } }), /outside task-owned paths/i);
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: 'src/secrets/token.txt' } }), /denied task path/i);
  await assert.rejects(() => broker.execute({ tool: 'fs.write', input: { path: 'tests/new.txt', content: 'no' } }), /outside task-owned paths/i);
  await assert.rejects(() => broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', 'process.exit(0)'], cwd: 'tests' } }), /outside task-owned paths/i);
});

test('ToolBroker reads exact line ranges with stable line metadata', async (t) => {
  const { broker } = await fixture(t);
  const result = await broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', startLine: 2, endLine: 2 } });
  assert.equal(result.output.content, 'beta\n');
  assert.equal(result.output.startLine, 2);
  assert.equal(result.output.endLine, 2);
  assert.equal(result.output.totalLines, 2);
  const head = await broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', headLines: 1 } });
  assert.equal(head.output.content, 'alpha\n');
  assert.equal(head.output.startLine, 1);
  assert.equal(head.output.endLine, 1);
  const tail = await broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', tailLines: 1 } });
  assert.equal(tail.output.content, 'beta\n');
  assert.equal(tail.output.startLine, 2);
  assert.equal(tail.output.endLine, 2);
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', startLine: 3 } }), /outside file/i);
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', headLines: 1, tailLines: 1 } }), /mutually exclusive/i);
});

test('ToolBroker performs bounded regex search with exact paths and line numbers', async (t) => {
  const { root, broker } = await fixture(t);
  await writeFile(path.join(root, 'src', 'b.txt'), 'gamma\nBeta two\n', 'utf8');
  const result = await broker.execute({ tool: 'fs.search', input: { query: '^beta', regex: true, caseSensitive: false, paths: ['src'], maxResults: 10 } });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.output.matches.map((match) => [match.path, match.line]), [['src/a.txt', 2], ['src/b.txt', 2]]);
  assert.equal(result.output.truncated, false);
  await assert.rejects(() => broker.execute({ tool: 'fs.search', input: { query: 'hidden', paths: ['../'] } }), /escapes workspace/i);
});

test('ToolBroker passes bounded stdin without exposing it in command arguments or receipts', async (t) => {
  const { broker } = await fixture(t);
  const result = await broker.execute({
    tool: 'process.run',
    input: { command: process.execPath, args: ['-e', "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(s.toUpperCase()))"], stdin: 'hello' },
  });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.stdout.trim(), 'HELLO');
  assert.equal(result.output.args.includes('hello'), false);
});
