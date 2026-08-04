import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { MultiFileRefactorEngine } from '../src/small-model/multi-file-refactor-engine.mjs';
import { CHECKPOINT_9_REFACTOR_PACKS } from '../src/small-model/checkpoint-9-refactor-pack.mjs';
import { Checkpoint9RefactorLab } from '../src/small-model/checkpoint-9-refactor-lab.mjs';
import { MultiFileRefactorSkillCompiler } from '../src/small-model/multi-file-refactor-skill-compiler.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourceFiles = [
  { path: 'src/api.mjs', source: `export function legacyName(value) { return value + 1; }\nconst obj = { legacyName: 1 };\nexport const label = 'legacyName';\nexport function inspect(){ return obj.legacyName; }\n` },
  { path: 'src/direct.mjs', source: `import { legacyName } from './api.mjs';\nexport const result = legacyName(2);\n` },
  { path: 'src/alias.mjs', source: `import { legacyName as run } from './api.mjs';\nexport const result = run(3);\n` },
].map((file) => ({ ...file, sha256: canonicalSha256(file.source) }));

test('MultiFileRefactorEngine renames one exported binding across declaration, direct imports, and bound uses', () => {
  const plan = new MultiFileRefactorEngine().plan({ files: sourceFiles, operation: { op: 'rename-exported-symbol', modulePath: 'src/api.mjs', from: 'legacyName', to: 'canonicalName' } });
  assert.equal(plan.changedFiles, 3);
  assert.equal(plan.changedTokens >= 4, true);
  const api = plan.files.find((file) => file.path === 'src/api.mjs').output;
  const direct = plan.files.find((file) => file.path === 'src/direct.mjs').output;
  const alias = plan.files.find((file) => file.path === 'src/alias.mjs').output;
  assert.match(api, /function canonicalName/);
  assert.match(api, /\{ legacyName: 1 \}/);
  assert.match(api, /'legacyName'/);
  assert.match(api, /obj\.legacyName/);
  assert.match(direct, /import \{ canonicalName \}/);
  assert.match(direct, /canonicalName\(2\)/);
  assert.match(alias, /import \{ canonicalName as run \}/);
  assert.match(alias, /run\(3\)/);
  assert.equal(plan.executedSource, false);
  assert.equal(plan.hiddenChainOfThoughtStored, false);
});

test('MultiFileRefactorEngine rejects target collisions, missing exports, stale hashes, and unsafe paths', () => {
  const engine = new MultiFileRefactorEngine();
  assert.throws(() => engine.plan({ files: sourceFiles, operation: { op: 'rename-exported-symbol', modulePath: 'src/api.mjs', from: 'missing', to: 'x' } }), /missing|export/i);
  assert.throws(() => engine.plan({ files: sourceFiles, operation: { op: 'rename-exported-symbol', modulePath: 'src/api.mjs', from: 'legacyName', to: 'label' } }), /collision/i);
  assert.throws(() => engine.plan({ files: [{ ...sourceFiles[0], sha256: '0'.repeat(64) }], operation: { op: 'rename-exported-symbol', modulePath: 'src/api.mjs', from: 'legacyName', to: 'x' } }), /hash/i);
  assert.throws(() => engine.plan({ files: sourceFiles, operation: { op: 'rename-exported-symbol', modulePath: '../api.mjs', from: 'legacyName', to: 'x' } }), /path|traversal/i);
});

test('Checkpoint9RefactorLab verifies two induction missions and held-out multi-file transfer with exact rollback', async () => {
  const lab = new Checkpoint9RefactorLab();
  const missions = await Promise.all(CHECKPOINT_9_REFACTOR_PACKS.slice(0, 2).map((pack) => lab.collect({ root, pack })));
  const skill = new MultiFileRefactorSkillCompiler().compile({ id: 'rename-public-api', version: '1', missions });
  const transfer = await lab.verify({ root, skill, heldOutPack: CHECKPOINT_9_REFACTOR_PACKS[2] });
  assert.equal(missions.every((mission) => mission.status === 'verified-recovery'), true);
  assert.equal(skill.sourceRepositoryIds.length, 2);
  assert.equal(skill.allowedPaths.length, 3);
  assert.equal(transfer.status, 'pass');
  assert.equal(transfer.repositoryDisjoint, true);
  assert.equal(transfer.changedFiles, 3);
  assert.equal(transfer.rollbackRestoredAllHashes, true);
  assert.equal(transfer.trackedSourcesUnchanged, true);
  assert.equal(transfer.bestCandidatePreserved, true);
  assert.equal(transfer.commentPreserved, true);
  assert.equal(transfer.stringPreserved, true);
  assert.equal(transfer.propertyKeysPreserved, true);
});

test('Checkpoint9RefactorLab never changes tracked fixture files', async () => {
  const pack = CHECKPOINT_9_REFACTOR_PACKS[2];
  const before = await Promise.all(pack.sourceFiles.map(async (file) => canonicalSha256(await readFile(path.join(root, pack.rootPath, file.path), 'utf8'))));
  const lab = new Checkpoint9RefactorLab();
  const missions = await Promise.all(CHECKPOINT_9_REFACTOR_PACKS.slice(0, 2).map((value) => lab.collect({ root, pack: value })));
  const skill = new MultiFileRefactorSkillCompiler().compile({ id: 'rename-public-api', version: '1', missions });
  await lab.verify({ root, skill, heldOutPack: pack });
  const after = await Promise.all(pack.sourceFiles.map(async (file) => canonicalSha256(await readFile(path.join(root, pack.rootPath, file.path), 'utf8'))));
  assert.deepEqual(after, before);
});
