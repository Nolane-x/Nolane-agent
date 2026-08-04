import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalName, inspectMetadata, label } from '../src/api.mjs';
import { directResult } from '../src/direct.mjs';
import { aliasResult } from '../src/alias.mjs';

test('canonical API remains available across direct and aliased consumers', () => {
  assert.equal(canonicalName(4), 5);
  assert.equal(directResult, 3);
  assert.equal(aliasResult, 4);
  assert.equal(inspectMetadata(), 'property-key');
  assert.equal(label, 'canonicalName remains in strings');
});
