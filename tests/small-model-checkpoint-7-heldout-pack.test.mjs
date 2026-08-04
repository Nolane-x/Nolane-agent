import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CHECKPOINT_7_HELDOUT_PACKS, verifyHeldOutPack } from '../src/small-model/checkpoint-7-heldout-pack.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const clone = (value) => structuredClone(value);

test('checkpoint 7 held-out packs verify three runtime-disjoint repository manifests', async () => {
  assert.equal(CHECKPOINT_7_HELDOUT_PACKS.length, 3);
  const verified = [];
  for (const pack of CHECKPOINT_7_HELDOUT_PACKS) {
    verified.push(await verifyHeldOutPack({ root, pack, trainingRepositoryIds: ['nolane-root', 'go-launcher', 'python-sdk'] }));
  }
  assert.deepEqual(verified.map((item) => item.runtime).sort(), ['go', 'node', 'python']);
  assert.equal(new Set(verified.map((item) => item.repositoryId)).size, 3);
  assert.ok(verified.every((item) => item.status === 'verified' && /^[a-f0-9]{64}$/.test(item.receiptSha256)));
});

test('held-out pack verification rejects overlap traversal symlink-style paths shell strings stale hashes and unsupported runtimes', async () => {
  const base = CHECKPOINT_7_HELDOUT_PACKS[0];
  await assert.rejects(() => verifyHeldOutPack({ root, pack: base, trainingRepositoryIds: [base.repositoryId] }), /overlap/i);

  const traversal = clone(base);
  traversal.sourcePath = '../package.json';
  await assert.rejects(() => verifyHeldOutPack({ root, pack: traversal, trainingRepositoryIds: [] }), /outside|traversal/i);

  const shell = clone(base);
  shell.command = `${process.execPath} --test`;
  await assert.rejects(() => verifyHeldOutPack({ root, pack: shell, trainingRepositoryIds: [] }), /argv|shell/i);

  const stale = clone(base);
  stale.sourceSha256 = '0'.repeat(64);
  await assert.rejects(() => verifyHeldOutPack({ root, pack: stale, trainingRepositoryIds: [] }), /hash/i);

  const runtime = clone(base);
  runtime.runtime = 'ruby';
  await assert.rejects(() => verifyHeldOutPack({ root, pack: runtime, trainingRepositoryIds: [] }), /runtime/i);

  const symlinkStyle = clone(base);
  symlinkStyle.testPath = 'test/../src/normalize.mjs';
  await assert.rejects(() => verifyHeldOutPack({ root, pack: symlinkStyle, trainingRepositoryIds: [] }), /normalized|traversal/i);
});
