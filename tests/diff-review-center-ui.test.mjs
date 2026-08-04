import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Diff Review Center exposes file and hunk-level accept/reject controls with stale refresh', async () => {
  const html = await readFile('ui/index.html', 'utf8');
  const app = await readFile('ui/app.js', 'utf8');
  const ui = await readFile('ui/diff-review-center.js', 'utf8');
  const css = await readFile('ui/diff-review-center.css', 'utf8');
  assert.match(html, /id="diff-review-center"/);
  assert.match(app, /import\(['"]\.\/diff-review-center\.js['"]\)/);
  assert.match(ui, /\/api\/agent\/runs\/.*\/diff-review/);
  assert.match(ui, /expectedReviewSha256/);
  assert.match(ui, /setAttribute\(['"]data-diff-decision['"], ['"]accept['"]\)/);
  assert.match(ui, /setAttribute\(['"]data-diff-decision['"], ['"]reject['"]\)/);
  assert.match(ui, /DIFF_REVIEW_STALE|409/);
  assert.match(css, /\.diff-review-file/);
  assert.match(css, /\.diff-hunk-line\.added/);
  assert.match(css, /\.diff-hunk-line\.removed/);
});
