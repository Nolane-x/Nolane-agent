import path from 'node:path';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const HASHES = Object.freeze({
  'src/api.mjs': '8494e5dc3094deef6d9be238603f90d469354fc1576febc019712088fdcb7a67',
  'src/direct.mjs': '81aa089ec296d5493526f79a21d73a85fc43dad00ea8a44f3f1c897870b48f86',
  'src/alias.mjs': '76dec1299b52dd947ebc748cc5b4ccc2dd6495c712da7434187b44b40830b4db',
  'test/refactor.test.mjs': 'c8e2c4898f559a412bee2d2d96f60d1328fad1f2dc97d57877168bf44bf9dce5',
});

const pack = (repositoryId, rootPath, role) => deepFreeze({
  schema: 'nolane.small-model.checkpoint-9-refactor-pack.v1',
  repositoryId,
  role,
  runtime: 'node',
  language: 'javascript',
  rootPath,
  sourceFiles: ['src/api.mjs', 'src/direct.mjs', 'src/alias.mjs'].map((filePath) => ({ path: filePath, sha256: HASHES[filePath] })),
  testFile: { path: 'test/refactor.test.mjs', sha256: HASHES['test/refactor.test.mjs'] },
  command: { shell: false, argv: [process.execPath, '--test', 'test/refactor.test.mjs'], timeoutMs: 30_000 },
  mutation: { op: 'rename-exported-symbol', modulePath: 'src/api.mjs', from: 'canonicalName', to: 'legacyName' },
  repair: { op: 'rename-exported-symbol', modulePath: 'src/api.mjs', from: 'legacyName', to: 'canonicalName' },
  verifierObligations: ['baseline-pass', 'multi-file-mutation-fail', 'multi-file-repair-pass', 'rollback-restores-all-hashes', 'tracked-sources-unchanged'],
});

export const CHECKPOINT_9_REFACTOR_PACKS = deepFreeze([
  pack('checkpoint-9-refactor-induction-a', 'fixtures/checkpoint-9-refactor/induction-a', 'induction'),
  pack('checkpoint-9-refactor-induction-b', 'fixtures/checkpoint-9-refactor/induction-b', 'induction'),
  pack('checkpoint-9-refactor-transfer-c', 'fixtures/checkpoint-9-refactor/transfer-c', 'transfer'),
]);

function safeRelative(value, label) {
  const text = String(value ?? '').replaceAll('\\', '/');
  if (!text || path.posix.isAbsolute(text) || text.split('/').includes('..')) throw new Error(`${label} path traversal is forbidden`);
  return path.posix.normalize(text);
}

async function shaFile(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function regularInside(root, relative, label) {
  const target = path.resolve(root, safeRelative(relative, label));
  const [rootReal, targetReal] = await Promise.all([realpath(root), realpath(target)]);
  const rel = path.relative(rootReal, targetReal);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${label} escapes project root`);
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  return target;
}

export async function verifyCheckpoint9RefactorPack({ root = process.cwd(), pack: value, trainingRepositoryIds = [] } = {}) {
  if (!value || value.schema !== 'nolane.small-model.checkpoint-9-refactor-pack.v1') throw new TypeError('Checkpoint 9 refactor pack is required');
  if (!value.repositoryId || !['induction', 'transfer'].includes(value.role)) throw new Error('Refactor pack identity and role are required');
  if (trainingRepositoryIds.includes(value.repositoryId)) throw new Error(`Refactor pack overlaps training lineage: ${value.repositoryId}`);
  if (value.runtime !== 'node' || value.language !== 'javascript') throw new Error('Checkpoint 9 refactor packs support Node JavaScript only');
  if (value.command?.shell !== false || !Array.isArray(value.command?.argv) || value.command.argv[0] !== process.execPath || value.command.argv[1] !== '--test') throw new Error('Refactor pack command must use allowlisted argv with shell disabled');
  if (!Number.isInteger(value.command.timeoutMs) || value.command.timeoutMs < 1 || value.command.timeoutMs > 120_000) throw new Error('Refactor pack timeout is invalid');
  const project = path.resolve(root, safeRelative(value.rootPath, 'project'));
  const rootReal = await realpath(path.resolve(root));
  const projectReal = await realpath(project);
  const rel = path.relative(rootReal, projectReal);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Refactor project escapes root');
  const sourceFiles = [];
  for (const item of value.sourceFiles ?? []) {
    const file = await regularInside(project, item.path, 'source');
    const sha256 = await shaFile(file);
    if (sha256 !== item.sha256) throw new Error(`Refactor source hash is stale: ${item.path}`);
    sourceFiles.push({ path: safeRelative(item.path, 'source'), sha256 });
  }
  if (sourceFiles.length < 3) throw new Error('Refactor pack requires at least three source files');
  const testFilePath = await regularInside(project, value.testFile?.path, 'test');
  const testSha256 = await shaFile(testFilePath);
  if (testSha256 !== value.testFile?.sha256) throw new Error('Refactor test hash is stale');
  if (canonicalSha256(value.mutation) === canonicalSha256(value.repair)) throw new Error('Mutation and repair must differ');
  if (value.mutation?.op !== 'rename-exported-symbol' || value.repair?.op !== 'rename-exported-symbol' || value.mutation.from !== value.repair.to || value.mutation.to !== value.repair.from || value.mutation.modulePath !== value.repair.modulePath) throw new Error('Refactor mutation and repair must be inverse operations');
  const base = {
    schema: 'nolane.small-model.checkpoint-9-refactor-pack-verification.v1',
    repositoryId: value.repositoryId,
    role: value.role,
    runtime: value.runtime,
    language: value.language,
    rootPath: value.rootPath,
    sourceFiles,
    testFile: { path: safeRelative(value.testFile.path, 'test'), sha256: testSha256 },
    command: { shell: false, argv: [...value.command.argv], timeoutMs: value.command.timeoutMs },
    mutation: { ...value.mutation },
    repair: { ...value.repair },
    verifierObligations: [...value.verifierObligations],
    hiddenChainOfThoughtStored: false,
    claims: { boundedMultiFileTransfer: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
