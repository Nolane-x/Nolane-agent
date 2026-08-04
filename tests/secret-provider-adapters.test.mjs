import test from 'node:test';
import assert from 'node:assert/strict';

import { VaultKvV2Provider, RemoteSecretManagerProvider } from '../src/security/secret-provider-adapters.mjs';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; }, async text() { return JSON.stringify(body); } };
}

test('VaultKvV2Provider reads KV v2 through HTTPS and exposes secret bytes only once', async () => {
  const calls = [];
  const provider = new VaultKvV2Provider({
    baseUrl: 'https://vault.example.com',
    getToken: async () => 'vault-token-super-secret',
    namespace: 'team-a',
    fetchImpl: async (url, options) => { calls.push([url, options]); return response(200, { data: { data: { apiKey: 'abc123' }, metadata: { version: 7 } } }); },
  });
  const lease = await provider.read({ mount: 'secret', path: 'apps/forge', field: 'apiKey', version: 7 });
  assert.equal(lease.publicView().provider, 'vault-kv-v2');
  assert.equal(lease.publicView().version, 7);
  const value = await lease.consume(async (bytes) => bytes.toString('utf8'));
  assert.equal(value, 'abc123');
  await assert.rejects(() => lease.consume(async () => 'again'), (error) => error.code === 'SECRET_LEASE_CONSUMED');
  assert.equal(calls[0][0], 'https://vault.example.com/v1/secret/data/apps/forge?version=7');
  assert.equal(calls[0][1].headers['x-vault-token'], 'vault-token-super-secret');
  assert.equal(calls[0][1].headers['x-vault-namespace'], 'team-a');
  assert.doesNotMatch(JSON.stringify(lease.publicView()), /abc123|vault-token-super-secret/);
});

test('RemoteSecretManagerProvider uses bearer auth and never leaks tokens or secret material in errors', async () => {
  const provider = new RemoteSecretManagerProvider({
    endpoint: 'https://secrets.example.com/v1/read',
    getAccessToken: async () => 'oauth-token-private',
    fetchImpl: async () => response(403, { error: 'denied', diagnostic: 'oauth-token-private' }),
  });
  await assert.rejects(() => provider.read({ name: 'prod/api-key' }), (error) => {
    assert.equal(error.code, 'SECRET_PROVIDER_REQUEST_FAILED');
    assert.doesNotMatch(error.message, /oauth-token-private|prod\/api-key/);
    return true;
  });
});

test('RemoteSecretManagerProvider supports base64 material and loopback development endpoints only', async () => {
  const provider = new RemoteSecretManagerProvider({
    endpoint: 'http://127.0.0.1:8201/read',
    getAccessToken: async () => 'local-token',
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.authorization, 'Bearer local-token');
      return response(200, { valueBase64: Buffer.from('runtime-secret').toString('base64'), version: 'v2' });
    },
  });
  const lease = await provider.read({ name: 'dev/key' });
  assert.equal(await lease.consume((bytes) => bytes.toString()), 'runtime-secret');
  assert.throws(() => new RemoteSecretManagerProvider({ endpoint: 'http://secrets.example.com/read', getAccessToken: async () => 'x' }), /HTTPS or loopback/i);
});
