import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChunkMerkleTree, diffMerkleNodes } from '../src/repository/merkle-index.mjs';

test('chunk merkle tree is deterministic and diff isolates one changed chunk', () => {
  const before = buildChunkMerkleTree([
    { path: 'src/a.mjs', chunkId: 'alpha', sha256: 'a'.repeat(64) },
    { path: 'src/a.mjs', chunkId: 'beta', sha256: 'b'.repeat(64) },
  ]);
  const same = buildChunkMerkleTree([
    { path: 'src/a.mjs', chunkId: 'beta', sha256: 'b'.repeat(64) },
    { path: 'src/a.mjs', chunkId: 'alpha', sha256: 'a'.repeat(64) },
  ]);
  assert.equal(before.rootSha256, same.rootSha256);
  const after = buildChunkMerkleTree([
    { path: 'src/a.mjs', chunkId: 'alpha', sha256: 'c'.repeat(64) },
    { path: 'src/a.mjs', chunkId: 'beta', sha256: 'b'.repeat(64) },
  ]);
  const diff = diffMerkleNodes(before, after);
  assert.deepEqual(diff.changedLeaves, ['src/a.mjs#alpha']);
  assert.equal(diff.unchangedLeaves.includes('src/a.mjs#beta'), true);
  assert.notEqual(after.rootSha256, before.rootSha256);
});
