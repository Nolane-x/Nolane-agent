import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildVsCodeExtension } from '../scripts/build-vscode-extension.mjs';

const require = createRequire(import.meta.url);

test('VS Code client prepares and retrieves bounded local task handoffs', async () => {
  await buildVsCodeExtension();
  const clientPath = path.resolve('extensions/vscode/extension/dist/client.js');
  delete require.cache[clientPath];
  const { NolaneAgentClient } = require(clientPath);
  const calls = [];
  const previousFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: init?.method === 'POST' ? 201 : 200, async json() { return { schema: 'forge.local-task-handoff.v1', taskId: 'builder', localWorkspace: '/managed/builder', receiptSha256: 'a'.repeat(64) }; } };
  };
  try {
    const client = new NolaneAgentClient({ baseUrl: 'http://127.0.0.1:8787', organizationId: 'local', workspaceId: 'default', projectId: 'project-1' }, { async get() { return 'token'; }, async store() {}, async delete() {} });
    await client.prepareLocalHandoff('mission-1', 'builder');
    await client.getLocalHandoff('builder');
  } finally {
    global.fetch = previousFetch;
  }
  assert.equal(calls[0].url, 'http://127.0.0.1:8787/api/local-task-handoffs');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { missionId: 'mission-1', taskId: 'builder' });
  assert.equal(calls[1].url, 'http://127.0.0.1:8787/api/local-task-handoffs/builder');
  assert.equal(calls[1].init.method, undefined);
});

test('VS Code local worktree helper validates handoff and opens only its absolute managed path', async () => {
  await buildVsCodeExtension();
  const helperPath = path.resolve('extensions/vscode/extension/dist/local-worktree.js');
  delete require.cache[helperPath];
  const { openLocalWorktree, validateLocalTaskHandoff } = require(helperPath);
  const calls = [];
  const vscode = {
    Uri: { file(value) { calls.push(['uri', value]); return { fsPath: value }; } },
    commands: { async executeCommand(...args) { calls.push(['command', ...args]); return true; } },
  };
  const bundle = { schema: 'forge.local-task-handoff.v1', missionId: 'mission-1', taskId: 'builder', localWorkspace: path.resolve('/managed/builder'), receiptSha256: 'a'.repeat(64) };
  assert.equal(validateLocalTaskHandoff(bundle).taskId, 'builder');
  await openLocalWorktree(vscode, bundle);
  assert.deepEqual(calls, [
    ['uri', path.resolve('/managed/builder')],
    ['command', 'vscode.openFolder', { fsPath: path.resolve('/managed/builder') }, true],
  ]);
  assert.throws(() => validateLocalTaskHandoff({ ...bundle, localWorkspace: 'relative/path' }), /absolute/i);
  assert.throws(() => validateLocalTaskHandoff({ ...bundle, receiptSha256: 'bad' }), /SHA-256/i);
});

test('VS Code extension contributes and registers transfer-local and open-worktree commands without shell execution', async () => {
  const pkg = JSON.parse(await readFile('extensions/vscode/extension/package.json', 'utf8'));
  const commands = new Set(pkg.contributes.commands.map((entry) => entry.command));
  assert.equal(commands.has('nolane.transferTaskLocal'), true);
  assert.equal(commands.has('nolane.openWorktree'), true);
  const source = await readFile('extensions/vscode/src/extension.ts', 'utf8');
  assert.match(source, /registerCommand\('nolane\.transferTaskLocal'/);
  assert.match(source, /registerCommand\('nolane\.openWorktree'/);
  assert.match(source, /prepareLocalHandoff\(requireRun\(\)\)/);
  assert.match(source, /openLocalWorktree\(vscode, handoff\)/);
  assert.doesNotMatch(source, /child_process|execFile|spawn\(/);
});
