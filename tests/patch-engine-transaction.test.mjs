import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedPatch, applyUnifiedPatch } from '../src/execution/unified-patch.mjs';

const PATCH = `--- a/src/a.txt\n+++ b/src/a.txt\n@@ -1,3 +1,3 @@\n alpha\n-beta\n+BETA\n gamma\n`;

test('patch transaction compatibility parses and applies unified hunks atomically', () => {
  const parsed = parseUnifiedPatch(PATCH);
  const result = applyUnifiedPatch('alpha\nbeta\ngamma\n', parsed);
  assert.equal(parsed.hunks.length, 1);
  assert.equal(result.content, 'alpha\nBETA\ngamma\n');
  assert.equal(result.appliedHunks, 1);
});

test('patch transaction compatibility rejects ambiguous or stale hunk context without partial output', () => {
  assert.throws(() => applyUnifiedPatch('alpha\ndifferent\ngamma\n', parseUnifiedPatch(PATCH)), /patch conflict.*hunk 1/i);
  assert.throws(() => parseUnifiedPatch('not a unified diff'), /patch|header|unified/i);
});
