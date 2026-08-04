import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedArray, finite, redacted, sha, signed, text } from '../src/intelligence-completion/completion-utils.mjs';

test('completion utilities validate bounded canonical inputs', () => {
  assert.equal(text('  ok  ', 'value', 10), 'ok');
  assert.throws(() => text('', 'value', 10), /value is required/);
  assert.equal(finite(2, 'n', 0, 3), 2);
  assert.throws(() => finite(Number.NaN, 'n', 0, 3), /finite/);
  assert.deepEqual(boundedArray([1, 2], 'items', 2), [1, 2]);
  assert.throws(() => boundedArray([1, 2, 3], 'items', 2), /at most 2/);
  assert.equal(sha('a'.repeat(64), 'digest'), 'a'.repeat(64));
  assert.throws(() => sha('bad', 'digest'), /SHA-256/);
});

test('signed receipts are deterministic, deeply frozen, and redact secrets', () => {
  const first = signed({ schema: 'forge.test.v1', nested: { value: 1 } });
  const second = signed({ nested: { value: 1 }, schema: 'forge.test.v1' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.nested), true);
  assert.match(redacted('token=ghp_123456789012345678901234567890123456'), /\[REDACTED\]/);
});
