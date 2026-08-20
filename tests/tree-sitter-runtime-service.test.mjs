import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { TreeSitterRuntimeService } from '../src/repository/tree-sitter-runtime-service.mjs';

const execFileAsync = promisify(execFile);

test('TreeSitterRuntimeService detects a pinned CLI and parses only project-bound files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'app.js'), 'class App {}\n');
  const calls = [];
  const runner = async (command, args, options) => {
    calls.push({ command, args, options });
    if (args[0] === '--version') return { stdout: 'tree-sitter 0.25.10\n', stderr: '' };
    return { stdout: JSON.stringify({ parse_summaries: [{ file: 'src/app.js', successful: true, bytes: 13 }], cumulative_stats: { bytes: 13 } }), stderr: '' };
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
  assert.equal(result.tree.parse_summaries[0].successful, true);
  assert.equal(result.projectId, 'p1');
  assert.equal(result.principalId, 'local-admin');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const parseCall = calls.find((call) => call.args[0] === 'parse');
  assert.deepEqual(parseCall.args.slice(0, 4), ['parse', '--json', '--quiet', '--']);
  assert.equal(parseCall.options.cwd, await realpath(root));
  assert.equal(parseCall.options.timeoutMs, 60_000);
});

test('TreeSitterRuntimeService passes a validated host-provided grammar configuration to the CLI', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-grammar-root-'));
  const configDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(configDirectory, { recursive: true, force: true }));
  await writeFile(path.join(root, 'sample.js'), 'export const answer = 42;\n', 'utf8');
  const configPath = path.join(configDirectory, 'config.json');
  await writeFile(configPath, JSON.stringify({ 'parser-directories': [path.dirname(root)] }), 'utf8');
  const calls = [];
  const service = new TreeSitterRuntimeService({
    projectResolver: () => ({ workspaceRoot: root }),
    expectedVersion: '0.25.10',
    configPath,
    runner: async (_command, args) => {
      calls.push(args);
      return args[0] === '--version'
        ? { stdout: 'tree-sitter 0.25.10\n', stderr: '' }
        : { stdout: JSON.stringify({ parse_summaries: [{ successful: true }] }), stderr: '' };
    },
  });

  await service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'sample.js' });
  const parseArgs = calls.find((args) => args[0] === 'parse');
  assert.deepEqual(parseArgs.slice(0, 6), ['parse', '--json', '--quiet', '--config-path', await realpath(configPath), '--']);
});

test('TreeSitterRuntimeService rejects a missing host-provided grammar configuration before invoking the CLI', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-missing-config-root-'));
  const configDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-missing-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(configDirectory, { recursive: true, force: true }));
  await writeFile(path.join(root, 'sample.js'), 'export const answer = 42;\n', 'utf8');
  const calls = [];
  const service = new TreeSitterRuntimeService({
    projectResolver: () => ({ workspaceRoot: root }),
    expectedVersion: '0.25.10',
    configPath: path.join(configDirectory, 'missing.json'),
    runner: async (_command, args) => {
      calls.push(args);
      return args[0] === '--version'
        ? { stdout: 'tree-sitter 0.25.10\n', stderr: '' }
        : { stdout: JSON.stringify({ parse_summaries: [{ successful: true }] }), stderr: '' };
    },
  });

  await assert.rejects(() => service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'sample.js' }), (error) => error.code === 'TREE_SITTER_CONFIG_INVALID' && error.statusCode === 503);
  assert.deepEqual(calls, []);
});

test('TreeSitterRuntimeService invokes the default Windows CLI through cmd.exe', { skip: process.platform !== 'win32' }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-windows-root-'));
  const bin = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-windows-bin-'));
  const originalPath = process.env.PATH;
  const originalPathCase = process.env.Path;
  const configuredPath = [bin, originalPath ?? originalPathCase ?? ''].join(path.delimiter);
  process.env.PATH = configuredPath;
  process.env.Path = configuredPath;
  t.after(async () => {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalPathCase === undefined) delete process.env.Path;
    else process.env.Path = originalPathCase;
    await Promise.all([rm(root, { recursive: true, force: true }), rm(bin, { recursive: true, force: true })]);
  });
  await writeFile(path.join(bin, 'tree-sitter.cmd'), [
    '@echo off',
    'if "%~1"=="--version" (',
    '  echo tree-sitter 0.25.10',
    '  exit /b 0',
    ')',
    'if "%~1"=="parse" (',
    '  echo {"parse_summaries":[{"file":"sample.js","successful":true,"bytes":1}],"cumulative_stats":{"bytes":1}}',
    '  exit /b 0',
    ')',
    'exit /b 1',
  ].join('\r\n'), 'utf8');
  await writeFile(path.join(root, 'sample.js'), 'export const answer = 42;\n', 'utf8');
  await writeFile(path.join(root, 'unsafe&path.js'), 'export const unsafe = true;\n', 'utf8');
  const service = new TreeSitterRuntimeService({
    projectResolver: () => ({ workspaceRoot: root }),
    expectedVersion: '0.25.10',
  });

  const discovered = await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'where.exe tree-sitter.cmd']);
  assert.match(discovered.stdout, /forge-tree-sitter-windows-bin-/i);
  const direct = await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'tree-sitter.cmd "--version"'], { windowsVerbatimArguments: true });
  assert.match(direct.stdout, /tree-sitter 0\.25\.10/);
  const capabilities = await service.capabilities();
  assert.equal(capabilities.available, true);
  const result = await service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'sample.js' });
  assert.equal(result.tree.parse_summaries[0].successful, true);
  await assert.rejects(() => service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'unsafe&path.js' }), (error) => error.code === 'TREE_SITTER_COMMAND_ARGUMENT_DENIED');
});

test('TreeSitterRuntimeService preserves the JSON parse receipt emitted by the CLI', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tree-sitter-envelope-'));
  await writeFile(path.join(root, 'app.js'), 'export const answer = 42;\n');
  const service = new TreeSitterRuntimeService({
    projectResolver: () => ({ workspaceRoot: root }),
    expectedVersion: '0.25.10',
    runner: async (_command, args) => args[0] === '--version'
      ? { stdout: 'tree-sitter 0.25.10\n', stderr: '' }
      : { stdout: JSON.stringify({ parse_summaries: [{ file: 'app.js', successful: true, bytes: 26 }], cumulative_stats: { bytes: 26 } }), stderr: '' },
  });

  const result = await service.parse({ projectId: 'p1', principalId: 'local-admin', file: 'app.js' });
  assert.equal(result.tree.parse_summaries[0].file, 'app.js');
  assert.equal(result.tree.parse_summaries[0].successful, true);
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
