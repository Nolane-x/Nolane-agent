import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('tiny Skills capability-state chips use readable primary text while semantics remain in labels and borders', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/skills.css', import.meta.url), 'utf8');
  assert.match(css, /\.skill-library-item__states>\[data-skill-capability-state\]\{[^}]*color:var\(--text-primary\)/);
  assert.doesNotMatch(css, /data-skill-capability-state="ready"[^}]*color:var\(--state-success\)/);
  assert.doesNotMatch(css, /data-skill-capability-state="blocked"[^}]*color:var\(--state-error\)/);
});
