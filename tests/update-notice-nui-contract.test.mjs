import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../ui-v3/styles/components/update-notice.css', import.meta.url), 'utf8');

test('update notice CSS has state-specific hierarchy instead of one generic card treatment', () => {
  assert.match(css, /data-update-severity="error"/);
  assert.match(css, /data-update-severity="blocked"/);
  assert.match(css, /data-update-severity="progress"/);
  assert.match(css, /update-notice__phase/);
  assert.match(css, /update-notice__evidence/);
  assert.match(css, /data-evidence-status="verified"/);
  assert.match(css, /data-evidence-status="active"/);
});

test('update notice preserves keyboard, reduced-motion, and forced-colors intent', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /animation:\s*none/);
});

test('update notice recomposes under content pressure and allows technical evidence to wrap safely', () => {
  assert.match(css, /max-width:\s*980px/);
  assert.match(css, /max-width:\s*640px/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(css, /update-notice__forensic dd\{[^}]*white-space:\s*nowrap/);
});
