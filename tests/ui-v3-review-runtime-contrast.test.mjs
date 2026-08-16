import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Review summary labels use a contrast-safe semantic text role at tiny sizes', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/review.css', import.meta.url), 'utf8');
  assert.match(css, /\.review-detail>\.review-summary small\{[^}]*color:var\(--text-primary\)/);
});
