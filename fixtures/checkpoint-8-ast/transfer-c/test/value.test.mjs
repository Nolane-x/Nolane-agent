import test from 'node:test';
import assert from 'node:assert/strict';
import { readValue, label } from '../src/value.mjs';

test('canonical value remains exported after repair', () => {
  assert.equal(readValue(), 'VALUE');
  assert.equal(label, 'legacyName remains in string');
});
