import test from 'node:test';
import assert from 'node:assert/strict';

import { CredentialVault, MemoryCredentialBackend } from '../src/security/credential-vault.mjs';
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.mjs';

test('credential vault stores and lists metadata without returning plaintext', async () => {
  const backend = new MemoryCredentialBackend();
  const vault = new CredentialVault({ backend });
  const written = await vault.set({ service: 'forge.provider.openai', account: 'default', secret: 'sk-super-secret-value' });
  assert.deepEqual(written, { service: 'forge.provider.openai', account: 'default', present: true });
  assert.equal(JSON.stringify(written).includes('sk-super'), false);
  const listed = await vault.list({ service: 'forge.provider.openai' });
  assert.deepEqual(listed, [{ service: 'forge.provider.openai', account: 'default', present: true }]);
  assert.equal(await vault.resolve({ service: 'forge.provider.openai', account: 'default' }), 'sk-super-secret-value');
  assert.equal(await vault.delete({ service: 'forge.provider.openai', account: 'default' }), true);
  assert.equal(await vault.resolve({ service: 'forge.provider.openai', account: 'default' }), null);
});

test('credential vault rejects invalid aliases, empty secrets, and oversized values', async () => {
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend(), maxSecretBytes: 32 });
  await assert.rejects(() => vault.set({ service: '../bad', account: 'default', secret: 'value' }), /service alias/i);
  await assert.rejects(() => vault.set({ service: 'forge.openai', account: 'bad/account', secret: 'value' }), /account alias/i);
  await assert.rejects(() => vault.set({ service: 'forge.openai', account: 'default', secret: '' }), /secret is required/i);
  await assert.rejects(() => vault.set({ service: 'forge.openai', account: 'default', secret: 'x'.repeat(33) }), /32 byte/i);
});

test('OpenAI-compatible provider resolves secretRef server-side and redacts secret-bearing errors', async () => {
  const secret = 'sk-secret-that-must-never-leak';
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend() });
  await vault.set({ service: 'forge.provider.openai', account: 'main', secret });
  let observedAuthorization = null;
  const provider = new OpenAICompatibleProvider({
    id: 'secure-openai', baseUrl: 'https://example.invalid/v1', model: 'test-model',
    secretRef: { service: 'forge.provider.openai', account: 'main' },
    credentialResolver: (ref) => vault.resolve(ref),
    fetchImpl: async (_url, init) => {
      observedAuthorization = init.headers.authorization;
      throw new Error(`upstream rejected ${secret}`);
    },
  });
  assert.equal(JSON.stringify(provider.publicView()).includes(secret), false);
  await assert.rejects(() => provider.complete({ messages: [{ role: 'user', content: 'hello' }] }), (error) => {
    assert.equal(error.message.includes(secret), false);
    assert.match(error.message, /\[REDACTED\]/);
    return true;
  });
  assert.equal(observedAuthorization, `Bearer ${secret}`);
});

import path from 'node:path';
import { CredentialHelperClient } from '../src/security/credential-helper-client.mjs';

test('credential helper client provides the vault backend contract over bounded JSONL-RPC', async (t) => {
  const client = new CredentialHelperClient({ command: process.execPath, args: [path.resolve('tests/fixtures/fake-credential-helper.mjs')], requestTimeoutMs: 1000 });
  t.after(() => client.close());
  const vault = new CredentialVault({ backend: client });
  await vault.set({ service: 'forge.provider.test', account: 'primary', secret: 'hidden-value' });
  assert.deepEqual(await vault.list({ service: 'forge.provider.test' }), [{ service: 'forge.provider.test', account: 'primary', present: true }]);
  assert.equal(await vault.resolve({ service: 'forge.provider.test', account: 'primary' }), 'hidden-value');
  assert.equal(await vault.delete({ service: 'forge.provider.test', account: 'primary' }), true);
});
