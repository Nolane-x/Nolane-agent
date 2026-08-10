import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { CHECKPOINT_8_AST_PACKS, verifyCheckpoint8AstPack } from '../src/small-model/checkpoint-8-ast-pack.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Checkpoint 8 AST packs are project-disjoint, hash-bound, and use argv commands', async () => {
  assert.equal(CHECKPOINT_8_AST_PACKS.length, 3);
  const verified = [];
  for (const pack of CHECKPOINT_8_AST_PACKS) verified.push(await verifyCheckpoint8AstPack({ root, pack, trainingRepositoryIds: [] }));
  assert.equal(new Set(verified.map((item) => item.repositoryId)).size, 3);
  for (const item of verified) {
    assert.equal(item.language, 'javascript');
    assert.equal(item.command.shell, false);
    assert.equal(Array.isArray(item.command.argv), true);
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
    assert.match(item.testSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(item.repair.operation, { op: 'rename-identifier', from: 'legacyName', to: 'canonicalName', scope: 'program' });
  }
});

test('Checkpoint 8 AST pack rejects training-lineage overlap and unsafe paths or commands', async () => {
  const pack = CHECKPOINT_8_AST_PACKS[0];
  await assert.rejects(() => verifyCheckpoint8AstPack({ root, pack, trainingRepositoryIds: [pack.repositoryId] }), /overlap|training/i);
  await assert.rejects(() => verifyCheckpoint8AstPack({ root, pack: { ...pack, sourcePath: '../escape.mjs' }, trainingRepositoryIds: [] }), /path|traversal/i);
  await assert.rejects(() => verifyCheckpoint8AstPack({ root, pack: { ...pack, command: { shell: true, argv: ['node', '--test'] } }, trainingRepositoryIds: [] }), /shell/i);
  await assert.rejects(() => verifyCheckpoint8AstPack({ root, pack: { ...pack, command: 'node --test' }, trainingRepositoryIds: [] }), /command|argv/i);
});

test('Checkpoint 8 AST pack rejects stale tracked source hashes', async () => {
  const pack = CHECKPOINT_8_AST_PACKS[0];
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nolane-cp8-pack-'));
  try {
    const copiedRoot = path.join(temp, 'repo');
    await cp(path.join(root, pack.rootPath), copiedRoot, { recursive: true });
    const file = path.join(copiedRoot, pack.sourcePath);
    await writeFile(file, `${await readFile(file, 'utf8')}\n// changed\n`);
    await assert.rejects(() => verifyCheckpoint8AstPack({ root: temp, pack: { ...pack, rootPath: 'repo' }, trainingRepositoryIds: [] }), /source hash|stale/i);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
