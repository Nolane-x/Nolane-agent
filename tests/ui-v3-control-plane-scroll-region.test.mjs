import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Control Plane route table scroll region is keyboard focusable and named', async () => {
  const source = await readFile('ui-v3/control-plane/live-domain-workspace.mjs', 'utf8');
  assert.match(source, /class="cp-route-table-wrap" role="region" tabindex="0" aria-label="\$\{escapeHtml\(t\.routesExposed\)\}"/);
  assert.doesNotMatch(source, /<div class="cp-route-table-wrap"><table>/);
});
