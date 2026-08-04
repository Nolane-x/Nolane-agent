import path from 'node:path';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const RUNTIMES = new Set(['node', 'go', 'python']);
const EXECUTABLES = Object.freeze({ node: new Set([process.execPath, 'node']), go: new Set(['go']), python: new Set(['python3', 'python']) });

export const CHECKPOINT_7_HELDOUT_PACKS = deepFreeze([
  {
    repositoryId: 'heldout-node-normalizer', runtime: 'node', rootPath: 'fixtures/checkpoint-7-heldout/node-normalizer',
    sourcePath: 'src/normalize.mjs', testPath: 'test/normalize.test.mjs', sourceSha256: '4887825d3eeacdc27cc7fcc78e4de4058449f0746726c145e165489c266e8f40', testSha256: '696a4459fd673a490bb1aade47717ffb11dae13869e2675f30147e09e91dc8ca',
    command: { argv: [process.execPath, '--test', 'test/normalize.test.mjs'], timeoutMs: 30_000 },
    mutation: { path: 'src/normalize.mjs', from: 'return normalized.toLowerCase();', to: 'return normalized;' },
    repair: { path: 'src/normalize.mjs', from: 'return normalized;', to: 'return normalized.toLowerCase();' },
    expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-node',
  },
  {
    repositoryId: 'heldout-go-normalizer', runtime: 'go', rootPath: 'fixtures/checkpoint-7-heldout/go-normalizer',
    sourcePath: 'normalize.go', testPath: 'normalize_test.go', sourceSha256: 'be39fdfbdc6c6bf2d92f9874b90ebcf6af0694af11594c5f293100a12d453235', testSha256: '7a761a7bd0125ac37b098197af7fee81413d1e6e43c7cb58a24bdd7b56e6d7f3',
    command: { argv: ['go', 'test', './...'], timeoutMs: 30_000 },
    mutation: { path: 'normalize.go', from: 'return strings.ToLower(normalized)', to: 'return normalized' },
    repair: { path: 'normalize.go', from: 'return normalized', to: 'return strings.ToLower(normalized)' },
    expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-go',
  },
  {
    repositoryId: 'heldout-python-normalizer', runtime: 'python', rootPath: 'fixtures/checkpoint-7-heldout/python-normalizer',
    sourcePath: 'normalize.py', testPath: 'test_normalize.py', sourceSha256: '1ecca0e11e947ee33dda0edda321ae679990b7e21481e730871dab8530ea6fab', testSha256: 'ee86a34bedd444cca3f1ae658b99924a283b70909d886462a51f64ff35f830c6',
    command: { argv: ['python3', '-m', 'unittest', 'test_normalize.py'], timeoutMs: 30_000 },
    mutation: { path: 'normalize.py', from: 'return normalized.lower()', to: 'return normalized' },
    repair: { path: 'normalize.py', from: 'return normalized', to: 'return normalized.lower()' },
    expected: { baselineExitCode: 0, mutationExitCode: 1, recoveryExitCode: 0 }, taskId: 'normalize-case-python',
  },
]);



export const CHECKPOINT_7_SKILL_TRANSFER_PACK = deepFreeze({
  repositoryId: 'heldout-node-normalizer-transfer', runtime: 'node', rootPath: 'fixtures/checkpoint-7-heldout/node-normalizer-transfer',
  sourcePath: 'src/normalize.mjs', testPath: 'test/normalize.test.mjs', sourceSha256: '4887825d3eeacdc27cc7fcc78e4de4058449f0746726c145e165489c266e8f40', testSha256: '17f32501d4fa936bf5ae35f70a5db4b9f8dcc680f3dac11d3ace6d2994676013',
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
