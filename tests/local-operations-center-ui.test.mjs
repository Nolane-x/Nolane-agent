import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source = await readFile(new URL('../ui/local-operations-center.js', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('../ui/local-operations-center.css', import.meta.url), 'utf8').catch(() => '');
const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');

test('Local Operations Center exposes six evidence-bound tabs and human-control actions', () => {
  for (const label of ['Images','Call Graph','Git History','Cost','Human Control','Cache']) assert.match(source, new RegExp(label));
  assert.match(source, /\/api\/local-operations\/images\/inspect/);
  assert.match(source, /\/api\/local-operations\/call-graph/);
  assert.match(source, /\/api\/local-operations\/git-history/);
  assert.match(source, /\/api\/local-operations\/cost/);
  assert.match(source, /\/api\/local-operations\/command-candidates/);
  assert.match(source, /\/api\/local-operations\/manual-control/);
  assert.match(source, /\/retain/); assert.match(source, /\/release/); assert.match(source, /\/api\/local-operations\/cache/);
  assert.match(source, /textContent/); assert.doesNotMatch(source, /innerHTML\s*=\s*[^`]/);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token/i);
  assert.match(css, /\.local-operations-center/); assert.match(css, /@media\s*\(max-width:/); assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /id="local-operations-button"/); assert.match(html, /id="local-operations-center"/);
  assert.match(app, /localOperations:\['\/local-operations-center\.js','initLocalOperationsCenter','local-operations-center','local-operations-button'/);
});
