import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('responsive CSS preserves features across narrow short high-zoom and forced-color windows', async () => {
  const css=await readFile(new URL('../ui-v3/styles/responsive.css',import.meta.url),'utf8');
  assert.match(css,/@media\s*\(max-height:/); assert.match(css,/env\(safe-area-inset-/); assert.match(css,/@media\s*\(forced-colors:\s*active\)/); assert.match(css,/overflow-x:\s*hidden/); assert.match(css,/min\(100%/); assert.match(css,/settings-nav/); assert.match(css,/output-summary/);
});
