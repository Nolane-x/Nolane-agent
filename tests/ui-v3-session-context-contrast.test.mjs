import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CSS_PATH = new URL('../ui-v3/styles/perfection/micro-detail.css', import.meta.url);

test('session project context uses a readable semantic text role at rest', async () => {
  const css = await readFile(CSS_PATH, 'utf8');
  const contextRule = css.match(/\.session-row__context\{([^}]*)\}/)?.[1] ?? '';
  assert.match(contextRule, /color:var\(--text-secondary\)/, 'project context must not rely on the faint text role because it is persistent readable content');
  assert.doesNotMatch(contextRule, /color:var\(--text-faint\)/, 'persistent project context must not use the low-contrast faint role');
});
