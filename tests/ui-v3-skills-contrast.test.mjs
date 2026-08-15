import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Skills footer action and supporting text remain readable on light raised surfaces', async () => {
  const styles = await readFile('ui-v3/styles/pages/skills.css', 'utf8');
  const actionRule = styles.match(/\.skills-library__preview footer a\{([^}]*)\}/)?.[1] ?? '';
  const detailRule = styles.match(/\.skills-library__preview footer small\{([^}]*)\}/)?.[1] ?? '';
  assert.match(actionRule, /color:var\(--text-primary\)/);
  assert.doesNotMatch(actionRule, /color:var\(--accent-strong\)/);
  assert.match(detailRule, /color:var\(--text-secondary\)/);
  assert.doesNotMatch(detailRule, /color:var\(--text-faint\)/);
});
