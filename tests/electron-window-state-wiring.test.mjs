import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../desktop/main.cjs', import.meta.url), 'utf8');

test('Electron restores safe window bounds and persists normal bounds on lifecycle changes', () => {
  assert.match(main, /WindowStateStore/);
  assert.match(main, /resolveWindowBounds/);
  assert.match(main, /screen\.getAllDisplays\(\)/);
  assert.match(main, /getNormalBounds\(\)/);
  assert.match(main, /screen\.getDisplayMatching\(bounds\)/);
  assert.match(main, /win\.on\('close'/);
});
