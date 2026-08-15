import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../ui-v3/styles/layout/app-shell.css', import.meta.url), 'utf8');

test('app-main reserves an auto row for update notice before flexible workspace', () => {
  assert.match(css, /\.app-main\{[^}]*grid-template-rows:var\(--topbar-height\) auto minmax\(0,1fr\)/);
});

test('settings shell reserves an auto update row before its flexible workspace', () => {
  assert.match(css, /\.app-shell\[data-shell-mode="settings"\]>\.app-main\{[^}]*grid-template-rows:auto minmax\(0,1fr\)/);
});
