import test from 'node:test';
import assert from 'node:assert/strict';

import { applyUnifiedPatch, parseUnifiedPatch, reverseUnifiedPatch, threeWayMerge } from '../src/execution/unified-patch.mjs';

const PATCH = `--- a/src/a.txt\n+++ b/src/a.txt\n@@ -1,2 +1,2 @@\n alpha\n-beta\n+bravo\n`;

test('unified patch supports dry-run semantics and exact reverse patches', () => {
  const parsed = parseUnifiedPatch(PATCH);
  const applied = applyUnifiedPatch('alpha\nbeta\n', parsed, { dryRun: true });
  assert.equal(applied.content, 'alpha\nbravo\n');
  assert.equal(applied.dryRun, true);
  const reversed = reverseUnifiedPatch(parsed);
  assert.equal(applyUnifiedPatch(applied.content, reversed).content, 'alpha\nbeta\n');
});

test('unified patch recognizes Git rename metadata without rewriting content', () => {
  const parsed = parseUnifiedPatch(`diff --git a/src/old.txt b/src/new.txt\nsimilarity index 100%\nrename from src/old.txt\nrename to src/new.txt\n`);
  assert.equal(parsed.oldPath, 'src/old.txt');
  assert.equal(parsed.newPath, 'src/new.txt');
  assert.equal(parsed.renameOnly, true);
  assert.equal(applyUnifiedPatch('same\n', parsed).content, 'same\n');
});

test('threeWayMerge preserves non-overlapping edits and emits explicit conflicts', () => {
  const clean = threeWayMerge({ base: 'a\nb\nc\n', ours: 'A\nb\nc\n', theirs: 'a\nb\nC\n' });
  assert.equal(clean.conflicted, false);
  assert.equal(clean.content, 'A\nb\nC\n');
  const conflict = threeWayMerge({ base: 'a\nb\n', ours: 'a\nours\n', theirs: 'a\ntheirs\n' });
  assert.equal(conflict.conflicted, true);
  assert.match(conflict.content, /<<<<<<< ours[\s\S]*>>>>>>> theirs/);
});
