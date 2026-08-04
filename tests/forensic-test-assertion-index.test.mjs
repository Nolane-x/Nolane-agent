import test from 'node:test';
import assert from 'node:assert/strict';
import { indexTestSource } from '../src/forensics/test-assertion-index.mjs';

test('test assertion index separates positive and negative named evidence', () => {
  const value = indexTestSource({ path: 'tests/example.test.mjs', source: `
    import test from 'node:test'; import assert from 'node:assert/strict';
    test('accepts a verified receipt', () => { assert.equal(run().status, 'pass'); assert.match(run().receipt, /^[a-f0-9]{64}$/); });
    test('rejects stale receipt hashes', () => { assert.throws(() => run({ stale: true }), /stale/i); assert.equal(run({ stale: true }).allowed, false); });
  ` });
  assert.deepEqual(value.namedTests, ['accepts a verified receipt', 'rejects stale receipt hashes']);
  assert.equal(value.positiveAssertions.length >= 2, true);
  assert.equal(value.negativeAssertions.length >= 2, true);
  assert.equal(value.hasPositiveEvidence, true);
  assert.equal(value.hasNegativeEvidence, true);
  assert.match(value.sourceSha256, /^[a-f0-9]{64}$/);
});

test('test assertion index can audit hidden-reasoning rejection tests but does not invent named evidence', () => {
  const security = indexTestSource({ path: 'tests/hidden.test.mjs', source: `test('rejects hiddenChainOfThought payloads', () => assert.equal(result.hiddenChainOfThoughtStored, false));` });
  assert.equal(security.hasNegativeEvidence, true);
  const value = indexTestSource({ path: 'tests/unnamed.test.mjs', source: `assert.equal(1, 1);` });
  assert.equal(value.namedTests.length, 0);
  assert.equal(value.hasPositiveEvidence, false);
});
