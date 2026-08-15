import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Time Travel comparison receipt uses primary evidence text contrast', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/mission-proofline-accessibility.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /\.time-travel__comparison\s*>\s*footer\s*>\s*code\s*\{[^}]*color:\s*var\(--text-primary\)/s,
    'The exact receipt identifier must not inherit faint code text inside the recovery panel.',
  );
});
