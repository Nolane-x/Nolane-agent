import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeQuantizedVector, encodeQuantizedVector } from '../src/repository/quantized-vector-codec.mjs';
import { cosineSimilarity } from '../src/repository/embedding-provider.mjs';

test('INT8 vector codec is deterministic and preserves cosine similarity', () => {
  const vector = [0.013, -0.22, 0.88, 0.41, -0.07];
  const first = encodeQuantizedVector(vector);
  const second = encodeQuantizedVector(vector);
  assert.equal(first.revision, 'symmetric-int8-v1');
  assert.equal(first.bytes.equals(second.bytes), true);
  assert.equal(first.scale, second.scale);
  const decoded = decodeQuantizedVector(first);
  assert.ok(cosineSimilarity(vector, decoded) > 0.999);
});

test('INT8 vector codec rejects corrupted payloads', () => {
  const encoded = encodeQuantizedVector([1, 0, -1]);
  assert.throws(() => decodeQuantizedVector({ ...encoded, dimensions: 4 }), /dimensions/i);
  assert.throws(() => decodeQuantizedVector({ ...encoded, scale: 0 }), /scale/i);
  assert.throws(() => encodeQuantizedVector([]), /non-empty/i);
});
