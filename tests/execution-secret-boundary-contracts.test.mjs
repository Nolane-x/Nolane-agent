import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { redactSecrets } from '../src/security/redaction.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

test('secret redaction removes nested credentials without mutating safe values', () => {
  const input = { token: 'secret-value', nested: { authorization: 'Bearer abcdefghijklmnop', safe: 'visible' } };
  const output = redactSecrets(input, { secretValues: ['secret-value', 'abcdefghijklmnop'] });
  assert.notEqual(output.token, 'secret-value');
  assert.doesNotMatch(JSON.stringify(output), /secret-value|Bearer abcdefghijklmnop/);
  assert.equal(output.nested.safe, 'visible');
});

test('workspace boundary rejects traversal and symlink escape before secret-bearing files are read', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-secret-boundary-')); t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'nolane-secret-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(outside, 'token.txt'), 'API_KEY=top-secret');
  await symlink(path.join(outside, 'token.txt'), path.join(root, 'src', 'escape.txt'));
  const broker = new ToolBroker({ workspaceRoot: root, allowedPaths: ['src/**'], allowedCommands: [] });
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: '../token.txt' } }), /escapes workspace|outside/i);
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: 'src/escape.txt' } }), /symlink|escapes workspace|outside/i);
});
