import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/normalize.mjs';

test('normalize trims and lowercases text', () => {
  assert.equal(normalize('  NoLane  '), 'nolane');
});

test('normalize preserves an empty normalized value', () => {
  assert.equal(normalize('   '), '');
});
