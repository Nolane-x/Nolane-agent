import path from 'node:path';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_SHA = '80ccd958c76d52ab8b365e9b942d0020cc5bb528e3a4a8b40bf8255544c80d86';
const TEST_SHA = '21c2a51d1c8999761deecaf94e213368754b905939f95b3a4a7fe0366aa0ac3d';

const pack = (repositoryId, rootPath, role) => deepFreeze({
  schema: 'nolane.small-model.checkpoint-8-ast-pack.v1',
  repositoryId,
  role,
  runtime: 'node',
  language: 'javascript',
  rootPath,
  sourcePath: 'src/value.mjs',
  testPath: 'test/value.test.mjs',
  sourceSha256: SOURCE_SHA,
  testSha256: TEST_SHA,
  command: { shell: false, argv: [process.execPath, '--test', 'test/value.test.mjs'], timeoutMs: 30_000 },
  mutation: { operation: { op: 'rename-identifier', from: 'canonicalName', to: 'legacyName', scope: 'program' }, expectedExitCode: 1 },
  repair: { operation: { op: 'rename-identifier', from: 'legacyName', to: 'canonicalName', scope: 'program' }, expectedExitCode: 0 },
  verifierObligations: ['baseline-pass', 'mutation-fail', 'repair-pass', 'rollback-restores-input-hash', 'tracked-source-unchanged'],
});

export const CHECKPOINT_8_AST_PACKS = deepFreeze([
  pack('checkpoint-8-ast-induction-a', 'fixtures/checkpoint-8-ast/induction-a', 'induction'),
  pack('checkpoint-8-ast-induction-b', 'fixtures/checkpoint-8-ast/induction-b', 'induction'),
  pack('checkpoint-8-ast-transfer-c', 'fixtures/checkpoint-8-ast/transfer-c', 'transfer'),
]);

function ensureRelativeSafe(value, label) {
  const text = String(value ?? '');
  if (!text || path.isAbsolute(text) || text.split(/[\\/]+/).includes('..')) throw new Error(`${label} path traversal is forbidden`);
  return text;
}

async function shaFile(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function ensureRegularInside(projectRoot, relative, label) {
  const safe = ensureRelativeSafe(relative, label);
  const target = path.resolve(projectRoot, safe);
  const rootReal = await realpath(projectRoot);
  const targetReal = await realpath(target);
  const rel = path.relative(rootReal, targetReal);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${label} escapes project root`);
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  return target;
}

export async function verifyCheckpoint8AstPack({ root = process.cwd(), pack: value, trainingRepositoryIds = [] } = {}) {
  if (!value || value.schema !== 'nolane.small-model.checkpoint-8-ast-pack.v1') throw new TypeError('Checkpoint 8 AST pack is required');
  if (!value.repositoryId || !['induction', 'transfer'].includes(value.role)) throw new TypeError('AST pack repository identity and role are required');
  if (trainingRepositoryIds.map(String).includes(String(value.repositoryId))) throw new Error(`AST pack overlaps training lineage: ${value.repositoryId}`);
  if (value.runtime !== 'node' || value.language !== 'javascript') throw new Error('Checkpoint 8 AST packs support only Node JavaScript');
  if (!value.command || typeof value.command !== 'object' || value.command.shell !== false || !Array.isArray(value.command.argv) || value.command.argv.length < 2) throw new Error('AST pack command must use an argv array with shell disabled');
  if (value.command.argv.some((part) => typeof part !== 'string' || part.length === 0)) throw new Error('AST pack command argv entries must be non-empty strings');
  if (value.command.argv[0] !== process.execPath || value.command.argv[1] !== '--test') throw new Error('AST pack command runtime is not allowlisted');
  if (!Number.isInteger(value.command.timeoutMs) || value.command.timeoutMs < 1 || value.command.timeoutMs > 120_000) throw new Error('AST pack timeout is outside the allowed budget');
  const projectRoot = path.resolve(root, ensureRelativeSafe(value.rootPath, 'project'));
  const rootReal = await realpath(path.resolve(root));
  const projectReal = await realpath(projectRoot);
  const projectRel = path.relative(rootReal, projectReal);
  if (projectRel.startsWith('..') || path.isAbsolute(projectRel)) throw new Error('AST pack project path escapes root');
  const sourceFile = await ensureRegularInside(projectRoot, value.sourcePath, 'source');
  const testFile = await ensureRegularInside(projectRoot, value.testPath, 'test');
  const sourceSha256 = await shaFile(sourceFile);
  const testSha256 = await shaFile(testFile);
  if (!SHA256.test(String(value.sourceSha256 ?? '')) || sourceSha256 !== value.sourceSha256) throw new Error('AST pack source hash is stale');
  if (!SHA256.test(String(value.testSha256 ?? '')) || testSha256 !== value.testSha256) throw new Error('AST pack test hash is stale');
  const mutation = value.mutation?.operation;
  const repair = value.repair?.operation;
  if (mutation?.op !== 'rename-identifier' || repair?.op !== 'rename-identifier' || mutation.from !== repair.to || mutation.to !== repair.from || mutation.scope !== 'program' || repair.scope !== 'program') throw new Error('AST pack mutation and repair operations must be inverse program-scope renames');
  const base = {
    schema: 'nolane.small-model.checkpoint-8-ast-pack-verification.v1',
    repositoryId: String(value.repositoryId), role: value.role, runtime: value.runtime, language: value.language,
    rootPath: value.rootPath, sourcePath: value.sourcePath, testPath: value.testPath,
    sourceSha256, testSha256,
    command: { shell: false, argv: [...value.command.argv], timeoutMs: value.command.timeoutMs },
    mutation: { operation: { ...mutation }, expectedExitCode: Number(value.mutation.expectedExitCode) },
    repair: { operation: { ...repair }, expectedExitCode: Number(value.repair.expectedExitCode) },
    verifierObligations: [...value.verifierObligations],
    hiddenChainOfThoughtStored: false,
    claims: { externalRepositoryGeneralization: false, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
