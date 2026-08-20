import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { authenticatedSourceUiUrl, sourceBrowserDataDirectory } from '../src/development/source-browser-launcher.mjs';

test('source browser bootstrap places the one-time token only in the fragment route', () => {
  const target = new URL(authenticatedSourceUiUrl({
    runtimeUrl: 'http://127.0.0.1:43173',
    token: 'local-test-token',
    route: '/settings?section=models',
  }));

  assert.equal(target.origin, 'http://127.0.0.1:43173');
  assert.equal(target.search, '');
  assert.equal(target.hash, '#/settings?section=models&token=local-test-token');
});

test('source browser bootstrap refuses non-loopback runtimes and blank tokens', () => {
  assert.throws(() => authenticatedSourceUiUrl({ runtimeUrl: 'https://nolane.example', token: 'local-test-token' }), /loopback/i);
  assert.throws(() => authenticatedSourceUiUrl({ runtimeUrl: 'http://127.0.0.1:43173', token: '   ' }), /token/i);
});

test('source browser defaults to temporary data while preserving an explicit data directory', () => {
  const temporaryRoot = path.join(process.cwd(), '.test-source-browser-runtime');

  assert.equal(
    sourceBrowserDataDirectory({ temporaryRoot, environment: {} }),
    path.join(temporaryRoot, 'data'),
  );
  assert.equal(
    sourceBrowserDataDirectory({ temporaryRoot, environment: { NOLANE_AGENT_DATA_DIR: 'D:\\Nolane data' } }),
    'D:\\Nolane data',
  );
  assert.throws(() => sourceBrowserDataDirectory({ environment: {} }), /temporary root/i);
});
