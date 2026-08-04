import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../ui/context-memory-center.js', import.meta.url), 'utf8').catch(() => '');
test('Context and Memory Center is a lazy professional evidence management surface', () => {
  assert.match(index, /id="context-memory-button"/);
  assert.match(app, /contextMemory:\s*\['\/context-memory-center\.js'/);
  assert.match(moduleSource, /History/);
  assert.match(moduleSource, /Artifacts/);
  assert.match(moduleSource, /Memory/);
  assert.match(moduleSource, /Budgets/);
  assert.match(moduleSource, /cm-aurora/);
  assert.match(moduleSource, /cm-grid-field/);
  assert.match(moduleSource, /cm-budget-meter/);
  assert.match(moduleSource, /\/api\/context-memory-center/);
  assert.match(moduleSource, /\/api\/adaptive\/context\//);
  assert.match(moduleSource, /\/api\/adaptive\/memory\//);
  assert.match(moduleSource, /method:\s*'DELETE'/);
  assert.doesNotMatch(moduleSource, /localStorage.*token|sessionStorage.*token/i);
});

test('Context and Memory Center visual layer respects reduced motion', async () => {
  const css = await readFile(new URL('../ui/context-memory-center.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /cm-aurora/);
  assert.match(css, /cm-grid-field/);
  assert.match(css, /cm-budget-meter/);
});
