import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../ui-v3/styles/pages/workroom.css', import.meta.url), 'utf8');

test('Studio welcome shortcut labels use readable secondary semantics on open canvas', () => {
  assert.match(css, /\.editor-welcome>div>span\{color:var\(--text-secondary\)\}/);
});
