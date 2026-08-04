import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ui/codebase-knowledge-center.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/codebase-knowledge-center.css', import.meta.url), 'utf8');

test('Codebase Knowledge Center exposes dedicated local semantic search and dependency topology surfaces', () => {
  assert.match(source, /semantic:\s*'Semantic Search'/);
  assert.match(source, /dependencies:\s*'Dependencies'/);
  assert.match(source, /\/api\/semantic-dependency\/search/);
  assert.match(source, /\/api\/semantic-dependency\/graph/);
  assert.match(source, /\/api\/semantic-dependency\/index/);
  assert.match(source, /knowledge-semantic-form/);
  assert.match(source, /knowledge-dependency-form/);
  assert.match(source, /knowledge-dependency-lanes/);
  assert.match(source, /receiptSha256/);
  assert.match(source, /scoreBreakdown/);
  assert.match(source, /cycles/);
  assert.match(css, /\.knowledge-semantic-result/);
  assert.match(css, /\.knowledge-dependency-lanes/);
  assert.match(css, /\.knowledge-dependency-node/);
  assert.match(css, /\.knowledge-receipt/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token/i);
});
