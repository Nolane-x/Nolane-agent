import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings runtime evidence supports progressive category rendering without requiring artificial scroll', async () => {
  const capturer = await readFile('scripts/capture-ui-runtime-visual.mjs', 'utf8');

  assert.match(capturer, /async function chooseSettingsCategory\(page, category\)/);
  assert.match(capturer, /await chooseSettingsCategory\(page, 'appearance'\)/);
  assert.match(capturer, /await chooseSettingsCategory\(page, 'general'\)/);
  assert.match(capturer, /scrollable:\s*targetTop\s*>\s*0/);
  assert.match(capturer, /scrollable:\s*top\s*>\s*0/);
  assert.doesNotMatch(capturer, /settings content is not scrollable/);
  assert.doesNotMatch(capturer, /cannot remain visible at a nonzero scroll position/);
});
