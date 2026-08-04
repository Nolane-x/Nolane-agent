import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { enumerateRepositoryFiles } from '../src/repository/repository-file-enumerator.mjs';

async function fixture(t) {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'nolane-discovery-contract-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'repo'); const outside = path.join(parent, 'outside');
  await mkdir(path.join(root, 'src'), { recursive: true }); await mkdir(path.join(root, 'node_modules'), { recursive: true }); await mkdir(outside);
  await writeFile(path.join(root, 'src', 'index.mjs'), 'export const ok = true;\n');
  await writeFile(path.join(root, 'README.md'), '# repo\n');
  await writeFile(path.join(root, 'node_modules', 'skip.js'), 'skip\n');
  await writeFile(path.join(outside, 'escape.mjs'), 'escape\n');
  await symlink(path.join(outside, 'escape.mjs'), path.join(root, 'src', 'escape.mjs'));
  return root;
}

test('repository discovery contract enumerates bounded files without following symlinks', async (t) => {
  const root = await fixture(t);
  const result = await enumerateRepositoryFiles(root, { maxFiles: 20, skipDirs: ['.git', 'node_modules'] });
  assert.deepEqual(result.files, ['README.md', 'src/index.mjs']);
  assert.equal(result.claims.symlinksFollowed, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('repository discovery contract rejects missing roots and enforces file budgets', async (t) => {
  await assert.rejects(() => enumerateRepositoryFiles(path.join(os.tmpdir(), 'missing-nolane-contract')), /enoent|not found/i);
  const root = await fixture(t);
  const result = await enumerateRepositoryFiles(root, { maxFiles: 1, skipDirs: ['.git', 'node_modules'] });
  assert.equal(result.files.length, 1);
  assert.equal(result.limited, true);
});
