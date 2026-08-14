import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Skills footer action text uses a foreground token that remains readable on light raised surfaces', async () => {
  const styles = await readFile('ui-v3/styles/pages/skills.css', 'utf8');
  const rule = styles.match(/\.skills-library__preview footer a\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /color:var\(--text-primary\)/);
  assert.doesNotMatch(rule, /color:var\(--accent-strong\)/);
});
