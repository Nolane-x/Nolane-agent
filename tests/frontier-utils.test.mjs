import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedArray, finite, sha, signed, text } from '../src/frontier/frontier-utils.mjs';

test('frontier receipts validate and freeze canonical public data', () => {
  assert.equal(text(' repo-a ', 'id', 32), 'repo-a');
  assert.equal(finite(0.75, 'confidence', 0, 1), 0.75);
  assert.deepEqual(boundedArray(['a', 'b'], 'items', 2), ['a', 'b']);
  assert.equal(sha('a'.repeat(64), 'hash'), 'a'.repeat(64));
  const receipt = signed({ schema: 'forge.test.v1', nested: { value: 1 } });
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.nested), true);
  assert.throws(() => { receipt.nested.value = 2; }, TypeError);
});

test('frontier validators fail closed on invalid public values', () => {
  assert.throws(() => finite(Infinity, 'score'), /finite/);
  assert.throws(() => sha('not-a-sha', 'hash'), /SHA-256/);
  assert.throws(() => boundedArray([1, 2, 3], 'items', 2), /at most 2/);
  assert.throws(() => text('', 'id', 32), /required/);
});
