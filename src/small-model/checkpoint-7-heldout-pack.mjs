import path from 'node:path';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const RUNTIMES = new Set(['node', 'go', 'python']);
const PYTHON_COMMAND = process.env.NOLANE_AGENT_PYTHON || process.env.FORGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const EXECUTABLES = Object.freeze({ node: new Set([process.execPath, 'node']), go: new Set(['go']), python: new Set(['python3', 'python', PYTHON_COMMAND]) });

export const CHECKPOINT_7_HELDOUT_PACKS = deepFreeze([
  {
    repositoryId: 'heldout-node-normalizer', runtime: 'node', rootPath: 'fixtures/checkpoint-7-heldout/node-normalizer',
    sourcePath: 'src/normalize.mjs', testPath: 'test/normalize.test.mjs', sourceSha256: '0f8130156afc685a8b6a6d4b331dbfc50dfb78a3c35a645e4aa6a751133f5c9c', testSha256: 'eb1d90c673a0c70f3949ee5f5f1c8ca9e927c83413150268af00258a880ed44d',
    command: { argv: [process.execPath, '--test', 'test/normalize.test.mjs'], timeoutMs: 30_000 },
    mutation: { path: 'src/normalize.mjs', from: 'return normalized.toLowerCase();', to: 'return normalized;' },
    repair: { path: 'src/normalize.mjs', from: 'return normalized;', to: 'return normalized.toLowerCase();' },
    expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-node',
  },
  {
    repositoryId: 'heldout-go-normalizer', runtime: 'go', rootPath: 'fixtures/checkpoint-7-heldout/go-normalizer',
    sourcePath: 'normalize.go', testPath: 'normalize_test.go', sourceSha256: 'dd99ce63a5a03a106746becc78cc5c01f0799b3444622413c9f81363254c5426', testSha256: '36b098055f6b5d12d4e1ddd32c9a0e8ac9ce4800e86ed0cbf7039622ef55b015',
    command: { argv: ['go', 'test', './...'], timeoutMs: 30_000 },
    mutation: { path: 'normalize.go', from: 'return strings.ToLower(normalized)', to: 'return normalized' },
    repair: { path: 'normalize.go', from: 'return normalized', to: 'return strings.ToLower(normalized)' },
    expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-go',
  },
  {
    repositoryId: 'heldout-python-normalizer', runtime: 'python', rootPath: 'fixtures/checkpoint-7-heldout/python-normalizer',
    sourcePath: 'normalize.py', testPath: 'test_normalize.py', sourceSha256: '4f6960448d7861283fe030c33fee6482a1554484e4a252a79c6ea9c97c5d91a7', testSha256: '3398997b7f413f9b8169b37d1dcad792167ba663ac5a76f5a8373d729d7141cc',
    command: { argv: [PYTHON_COMMAND, '-m', 'unittest', 'test_normalize.py'], timeoutMs: 30_000 },
    mutation: { path: 'normalize.py', from: 'return normalized.lower()', to: 'return normalized' },
    repair: { path: 'normalize.py', from: 'return normalized', to: 'return normalized.lower()' },
    expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-python',
  },
]);



export const CHECKPOINT_7_SKILL_TRANSFER_PACK = deepFreeze({
  repositoryId: 'heldout-node-normalizer-transfer', runtime: 'node', rootPath: 'fixtures/checkpoint-7-heldout/node-normalizer-transfer',
  sourcePath: 'src/normalize.mjs', testPath: 'test/normalize.test.mjs', sourceSha256: '0f8130156afc685a8b6a6d4b331dbfc50dfb78a3c35a645e4aa6a751133f5c9c', testSha256: '56b819107401852fa2911a27fcff0b28035b088f6fc1e0ac265fafc0a6db7d2a',
  command: { argv: [process.execPath, '--test', 'test/normalize.test.mjs'], timeoutMs: 30_000 },
  mutation: { path: 'src/normalize.mjs', from: 'return normalized.toLowerCase();', to: 'return normalized;' },
  repair: { path: 'src/normalize.mjs', from: 'return normalized;', to: 'return normalized.toLowerCase();' },
  expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-node-transfer',
});

function relativePath(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value)) throw new TypeError(label + ' must be a normalized relative path');
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error(label + ' contains traversal or is not normalized');
  return normalized;
}

async function sha256File(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function assertCommand(runtime, command) {
  if (!command || typeof command !== 'object' || !Array.isArray(command.argv) || command.argv.length < 1) throw new TypeError('Command must use an argv array; shell strings are forbidden');
  if (!command.argv.every((item) => typeof item === 'string' && item.length > 0 && !item.includes('\0'))) throw new TypeError('Command argv must contain safe strings');
  if (!EXECUTABLES[runtime].has(command.argv[0])) throw new Error('Command executable does not match the held-out runtime allowlist');
  const timeoutMs = Number(command.timeoutMs ?? 30_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) throw new TypeError('Command timeout is outside the bounded range');
  return { argv: [...command.argv], timeoutMs };
}

export async function verifyHeldOutPack({ root = process.cwd(), pack, trainingRepositoryIds = [] } = {}) {
  if (!pack || typeof pack !== 'object') throw new TypeError('Held-out pack is required');
  if (!pack.repositoryId || new Set(trainingRepositoryIds.map(String)).has(String(pack.repositoryId))) throw new Error('Held-out repository overlaps training repository lineage');
  if (!RUNTIMES.has(pack.runtime)) throw new TypeError('Unsupported held-out runtime');
  const rootPath = relativePath(pack.rootPath, 'rootPath');
  const sourcePath = relativePath(pack.sourcePath, 'sourcePath');
  const testPath = relativePath(pack.testPath, 'testPath');
  const mutationPath = relativePath(pack.mutation?.path, 'mutation.path');
  const repairPath = relativePath(pack.repair?.path, 'repair.path');
  if (mutationPath !== sourcePath || repairPath !== sourcePath) throw new Error('Mutation and repair must target the declared source path');
  if (!pack.mutation?.from || !pack.mutation?.to || !pack.repair?.from || !pack.repair?.to) throw new TypeError('Exact mutation and repair replacements are required');
  if (pack.mutation.from !== pack.repair.to || pack.mutation.to !== pack.repair.from) throw new Error('Repair must exactly reverse the declared mutation');
  const project = path.resolve(root, rootPath);
  const source = path.resolve(project, sourcePath);
  const test = path.resolve(project, testPath);
  const [projectReal, sourceReal, testReal] = await Promise.all([realpath(project), realpath(source), realpath(test)]);
  for (const [label, value] of [['source', sourceReal], ['test', testReal]]) {
    if (value !== projectReal && !value.startsWith(projectReal + path.sep)) throw new Error(label + ' resolves outside the held-out project');
    const stat = await lstat(value);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(label + ' must be a regular non-symlink file');
  }
  const [sourceSha256, testSha256] = await Promise.all([sha256File(sourceReal), sha256File(testReal)]);
  if (!SHA256.test(String(pack.sourceSha256 ?? '')) || sourceSha256 !== pack.sourceSha256) throw new Error('Held-out source hash mismatch');
  if (!SHA256.test(String(pack.testSha256 ?? '')) || testSha256 !== pack.testSha256) throw new Error('Held-out test hash mismatch');
  const command = assertCommand(pack.runtime, pack.command);
  const expected = pack.expected ?? {};
  if (expected.baselineExitCode !== 0 || expected.recoveryExitCode !== 0 || expected.mutationExitCode === 0) throw new Error('Held-out expected outcomes must include pass, fail, pass');
  const base = {
    schema: 'nolane.small-model.checkpoint-7-heldout-pack.v1', status: 'verified', repositoryId: String(pack.repositoryId), taskId: String(pack.taskId),
    runtime: pack.runtime, rootPath, sourcePath, testPath, sourceSha256, testSha256, command, mutation: { ...pack.mutation }, repair: { ...pack.repair }, expected: { ...expected },
    trainingRepositoryDisjoint: true, shellUsed: false, hiddenChainOfThoughtStored: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
