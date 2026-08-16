import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Projects diagnostics capture geometry, scroll, and fresh versus route-roundtrip states', async () => {
  const source = await read('scripts/capture-ui-layout-diagnostics.mjs');
  for (const marker of [
    'fresh-1440', 'fresh-980', 'roundtrip-1440', 'roundtrip-980',
    'workspaceScrollTop', 'documentScrollTop', 'workspaceRect', 'contentRect',
    'headerRect', 'toolbarRect', 'firstRecordRect', 'computedStyle', 'activeElement',
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /captureProjectsLayout/);
  assert.match(source, /page\.goto/);
  assert.match(source, /location\.hash/);
});
