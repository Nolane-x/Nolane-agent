import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings no-results copy uses a contrast-safe semantic text role', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/settings.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-empty\{[^}]*color:var\(--text-primary\)/);
});
