import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ui/codebase-knowledge-center.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/codebase-knowledge-center.css', import.meta.url), 'utf8');

test('Codebase Knowledge Center exposes local AST query and guarded dry-run/apply controls', () => {
  assert.match(source, /ast:\s*'AST Intelligence'/);
  assert.match(source, /knowledge-panel-ast/);
  assert.match(source, /\/api\/code\/ast-query/);
  assert.match(source, /\/api\/code\/ast-patch/);
  assert.match(source, /knowledge-ast-form/);
  assert.match(source, /knowledge-ast-replacement/);
  assert.match(source, /Dry run/);
  assert.match(source, /Apply guarded patch/);
  assert.match(source, /expectedSha256/);
  assert.match(source, /expectedNodeSha256/);
  assert.match(source, /receiptSha256/);
  assert.match(css, /\.knowledge-ast-shell/);
  assert.match(css, /\.knowledge-ast-result/);
  assert.match(css, /\.knowledge-ast-replacement/);
  assert.match(css, /\.knowledge-ast-warning/);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token/i);
});
