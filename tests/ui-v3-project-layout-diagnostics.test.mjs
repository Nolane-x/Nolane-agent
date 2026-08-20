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

test('Projects diagnostic workflow runs against the authenticated source runtime and uploads evidence', async () => {
  const workflow = await read('.github/workflows/product-perfection-projects-diagnostics.yml');
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /playwright@1\.58\.2/);
  assert.match(workflow, /node src\/app\.mjs/);
  assert.match(workflow, /capture-ui-layout-diagnostics\.mjs/);
  assert.match(workflow, /product-perfection-projects-diagnostics/);
});
