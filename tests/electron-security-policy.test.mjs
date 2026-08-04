import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function load() { return require('../desktop/security-policy.cjs'); }

test('Electron window policy enables isolation and sandbox while disabling Node integration', () => {
  const { browserWindowOptions } = load();
  const options = browserWindowOptions('/app/preload.cjs');
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.webSecurity, true);
  assert.equal(options.webPreferences.preload, '/app/preload.cjs');
});

test('Electron navigation policy allows only the authenticated loopback runtime origin', () => {
  const { isAllowedRuntimeUrl } = load();
  const origin = 'http://127.0.0.1:43123';
  assert.equal(isAllowedRuntimeUrl(`${origin}/?token=x`, origin), true);
  assert.equal(isAllowedRuntimeUrl(`${origin}/api/health`, origin), true);
  assert.equal(isAllowedRuntimeUrl('http://127.0.0.1:9999/', origin), false);
  assert.equal(isAllowedRuntimeUrl('https://example.com/', origin), false);
  assert.equal(isAllowedRuntimeUrl('file:///tmp/index.html', origin), false);
});

test('Electron external URL policy permits only explicit HTTPS links', () => {
  const { isSafeExternalUrl } = load();
  assert.equal(isSafeExternalUrl('https://docs.example.com/guide'), true);
  assert.equal(isSafeExternalUrl('http://example.com/'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('file:///C:/secret'), false);
  assert.equal(isSafeExternalUrl('https://user:pass@example.com/'), false);
});
