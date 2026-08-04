import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ui/codebase-knowledge-center.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/codebase-knowledge-center.css', import.meta.url), 'utf8');

test('Codebase Knowledge Center exposes inheritance graph and local issue-to-code evidence surfaces', () => {
  assert.match(source, /inheritance:\s*'Inheritance'/);
  assert.match(source, /issues:\s*'Issue Links'/);
  assert.match(source, /\/api\/code-relationships\/index/);
  assert.match(source, /\/api\/code-relationships\/inheritance/);
  assert.match(source, /\/api\/code-relationships\/issues/);
  assert.match(source, /knowledge-inheritance-form/);
  assert.match(source, /knowledge-inheritance-edge/);
  assert.match(source, /knowledge-inheritance-unresolved/);
  assert.match(source, /knowledge-issue-form/);
  assert.match(source, /knowledge-issue-link/);
  assert.match(source, /commitHash/);
  assert.match(source, /receiptSha256/);
  assert.match(css, /\.knowledge-inheritance-map/);
  assert.match(css, /\.knowledge-inheritance-edge/);
  assert.match(css, /\.knowledge-issue-card/);
  assert.match(css, /\.knowledge-issue-link/);
  assert.doesNotMatch(source, /github\.com\/api|api\.github\.com|jira/i);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token/i);
});
