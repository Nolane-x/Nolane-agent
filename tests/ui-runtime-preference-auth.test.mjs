import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('runtime visual preference mutations carry the authenticated evidence credential', async () => {
  const source = await readFile(new URL('../scripts/capture-ui-runtime-visual.mjs', import.meta.url), 'utf8');
  assert.match(source, /async function applyStatePreferences\(page, state, credential\)/);
  assert.match(source, /authorization:\s*'Bearer '\s*\+\s*credential/);
  assert.match(source, /await applyStatePreferences\(page, state, credential\)/);
});
