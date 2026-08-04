import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/normalize.mjs';

test('transfer repository normalizes mixed-case identifiers', () => {
  assert.equal(normalize('  AgentOS  '), 'agentos');
});

test('transfer repository normalizes already-lowercase values', () => {
  assert.equal(normalize(' nolane '), 'nolane');
});
