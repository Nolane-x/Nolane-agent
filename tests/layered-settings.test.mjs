import test from 'node:test';
import assert from 'node:assert/strict';

import { LayeredSettings } from '../src/settings/layered-settings.mjs';

test('LayeredSettings resolves defaults, user, project, and local values with leaf provenance', () => {
  const settings = new LayeredSettings({ lockedKeys: ['security.allowExternalNavigation', 'security.disableSandbox', 'credentials.*'] });
  const result = settings.resolve({
    defaults: { ui: { theme: 'dark' }, browser: { headed: true, snapshotDepth: 4 }, security: { allowExternalNavigation: false, disableSandbox: false }, model: { provider: 'auto' } },
    user: { ui: { theme: 'obsidian' }, browser: { headed: false } },
    project: { browser: { snapshotDepth: 3 }, security: { allowExternalNavigation: true }, credentials: { apiKey: 'must-not-merge' } },
    local: { model: { provider: 'codex' }, browser: { headed: true } },
  });
  assert.equal(result.value.ui.theme, 'obsidian');
  assert.equal(result.value.browser.snapshotDepth, 3);
  assert.equal(result.value.browser.headed, true);
  assert.equal(result.value.model.provider, 'codex');
  assert.equal(result.value.security.allowExternalNavigation, false);
  assert.equal(result.value.credentials, undefined);
  assert.equal(result.provenance['browser.headed'], 'local');
  assert.equal(result.provenance['browser.snapshotDepth'], 'project');
  assert.equal(result.provenance['security.allowExternalNavigation'], 'defaults');
  assert.equal(result.warnings.length, 2);
  assert.ok(Object.isFrozen(result.value));
});

test('LayeredSettings supports explicit deletions only for non-locked values and rejects prototype keys', () => {
  const settings = new LayeredSettings({ lockedKeys: ['security.*'] });
  const result = settings.resolve({ defaults: { ui: { density: 'comfortable' }, security: { sandbox: true } }, project: { ui: { density: null }, security: { sandbox: null } } });
  assert.equal(result.value.ui.density, undefined);
  assert.equal(result.value.security.sandbox, true);
  assert.throws(() => settings.resolve({ project: JSON.parse('{"__proto__":{"polluted":true}}') }), /prototype|key/i);
});
