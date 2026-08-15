import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dirty Settings primary action uses the contrast-safe accent foreground contract', async () => {
  const css = await readFile('ui-v3/styles/pages/settings.css', 'utf8');
  const match = css.match(/\.settings-actions>button\.primary\[data-settings-save-state="dirty"\]\{([^}]*)\}/);
  assert.ok(match, 'dirty save-state material rule must exist');
  assert.match(match[1], /background:var\(--accent\)/);
  assert.match(match[1], /color:var\(--nolane-ink\)/, 'bright accent surfaces must use the dark ink foreground');
  assert.doesNotMatch(match[1], /color:var\(--text-inverse\)/, 'inverse text is not contrast-safe for every supported accent');
});
