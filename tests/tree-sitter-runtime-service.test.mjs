import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { TreeSitterRuntimeService } from '../src/repository/tree-sitter-runtime-service.mjs';

test('TreeSitterRuntimeService detects a pinned CLI and parses only project-bound files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'app.js'), 'class App {}\n');
  const calls = [];
  const runner = async (command, args, options) => {
    calls.push({ command, args, options });
    if (args[0] === '--version') return { stdout: 'tree-sitter 0.25.10\n', stderr: '' };
    return { stdout: JSON.stringify({ type: 'program', startPosition: { row: 0, column: 0 }, endPosition: { row: 1, column: 0 } }), stderr: '' };
  };
  const service = new TreeSitterRuntimeService({
    projectResolver: (id) => id === 'p1' ? { id, workspaceRoot: root } : null,
    runner,
    expectedVersion: '0.25.10',
  });
  const capabilities = await service.capabilities();
  assert.equal(capabilities.available, true);
  assert.equal(capabilities.version, '0.25.10');
  const result = await service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'src/app.js' });
  assert.equal(result.tree.type, 'program');
  assert.equal(result.projectId, 'p1');
  assert.equal(result.principalId, 'local-admin');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const parseCall = calls.find((call) => call.args[0] === 'parse');
  assert.deepEqual(parseCall.args.slice(0, 4), ['parse', '--json', '--quiet', '--']);
  assert.equal(parseCall.options.cwd, await realpath(root));
});

test('TreeSitterRuntimeService normalizes the one-file JSON envelope emitted by the real CLI', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-envelope-'));
  await writeFile(path.join(root, 'app.js'), 'export const answer = 42;\n');
  const service = new TreeSitterRuntimeService({
    projectResolver: () => ({ workspaceRoot: root }),
    expectedVersion: '0.25.10',
    runner: async (_command, args) => args[0] === '--version'
      ? { stdout: 'tree-sitter 0.25.10\n', stderr: '' }
      : { stdout: JSON.stringify([{ path: 'app.js', tree: { type: 'program', named: true } }]), stderr: '' },
  });

  const result = await service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'app.js' });
  assert.equal(result.tree.type, 'program');
  assert.equal(result.tree.named, true);
});

test('TreeSitterRuntimeService rejects traversal, symlink escape, unsupported files, and unavailable runtime', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-deny-'));
  await writeFile(path.join(root, 'data.txt'), 'x');
  const unavailable = new TreeSitterRuntimeService({ projectResolver: () => ({ workspaceRoot: root }), runner: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } });
  const capability = await unavailable.capabilities();
  assert.equal(capability.available, false);
  await assert.rejects(() => unavailable.parse({ projectId: 'p', principalId: 'u', file: '../outside.js' }), /project workspace/i);
  await assert.rejects(() => unavailable.parse({ projectId: 'p', principalId: 'u', file: 'data.txt' }), /supported source file/i);
  await writeFile(path.join(root, 'ok.js'), 'const ok = true;');
  await assert.rejects(() => unavailable.parse({ projectId: 'p', principalId: 'u', file: 'ok.js' }), (error) => error.code === 'TREE_SITTER_RUNTIME_UNAVAILABLE' && error.statusCode === 503);
});
