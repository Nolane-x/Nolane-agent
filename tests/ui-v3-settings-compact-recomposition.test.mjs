import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings structurally recomposes into one content column at compact width', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/settings.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-center\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-nav\{[^}]*border-right:0[^}]*border-bottom:1px solid var\(--border-default\)/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-nav>nav\{[^}]*display:flex[^}]*overflow-x:auto/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-content\{[^}]*padding:/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-toolbar\{[^}]*flex-direction:column/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-actions\{[^}]*width:100%[^}]*flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.settings-actions>button\{[^}]*white-space:nowrap/);
});

test('Vietnamese compact runtime assertion measures Settings hierarchy instead of language alone', async () => {
  const source = await readFile(new URL('../scripts/capture-ui-runtime-visual.mjs', import.meta.url), 'utf8');
  assert.match(source, /settingsStacked:/);
  assert.match(source, /contentShare:/);
  assert.match(source, /actionsUnclipped:/);
  assert.match(source, /result\.settingsStacked/);
  assert.match(source, /result\.contentShare < 0\.9/);
  assert.match(source, /!result\.actionsUnclipped/);
  assert.match(source, /settingsCompactHierarchy: 'PASS'/);
});
