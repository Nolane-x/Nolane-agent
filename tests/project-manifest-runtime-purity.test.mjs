import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('project manifest generator has no NolaneNative vendor inclusion or runtime description', async () => {
  const source = await readFile('scripts/generate-manifest.mjs', 'utf8');
  assert.doesNotMatch(source, /vendor\/nolane_native-agent/);
  assert.doesNotMatch(source, /NolaneNative Agent sidecar|NolaneNative Agent provenance/i);
});
