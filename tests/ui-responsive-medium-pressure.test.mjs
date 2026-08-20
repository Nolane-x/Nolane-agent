import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('medium-width shell collapses the session sidebar before Control Plane becomes cramped', async () => {
  const css = await readFile('ui-v3/styles/responsive.css', 'utf8');
  assert.match(css, /@media \(max-width:979px\)\{\.app-shell:not\(\[data-shell-mode="settings"\]\)\{grid-template-columns:48px minmax\(0,1fr\)\}/);
  assert.doesNotMatch(css, /@media \(max-width:899px\)\{\.app-shell:not\(\[data-shell-mode="settings"\]\)/);
});
