import test from 'node:test';
import assert from 'node:assert/strict';

import { SecretAccessService } from '../src/security/secret-access-service.mjs';
import { SecretLease } from '../src/security/secret-provider-adapters.mjs';

function provider(value = 'hidden-material') {
  return { async read(reference) { return new SecretLease({ provider: 'vault-kv-v2', version: 1, bytes: Buffer.from(value), metadata: { mount: reference.mount } }); } };
}

test('SecretAccessService authorizes before provider access and never returns plaintext', async () => {
  const order = [];
  const events = [];
  const service = new SecretAccessService({
    guardrail: { authorize(input) { order.push(['authorize', input.action]); return { decision: 'allow', receiptSha256: 'a'.repeat(64) }; } },
    providers: { vault: { async read(reference) { order.push(['read', reference]); return provider().read(reference); } } },
    eventSink: (event) => events.push(event),
  });
  const result = await service.withSecret({ principalId: 'agent-1', sessionId: 's1', taskContract: {}, provider: 'vault', reference: { mount: 'secret', path: 'apps/forge', field: 'apiKey' } }, async (bytes) => ({ byteLength: bytes.length }));
  assert.deepEqual(order.map(([name]) => name), ['authorize', 'read']);
  assert.equal(result.output.byteLength, 15);
  assert.equal(result.secret.provider, 'vault-kv-v2');
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify({ result, events }), /hidden-material/);
});

test('SecretAccessService is deny-first and does not call providers on denial', async () => {
  let reads = 0;
  const service = new SecretAccessService({
    guardrail: { authorize() { const error = new Error('denied'); error.code = 'ACTION_GUARDRAIL_DENIED'; throw error; } },
    providers: { vault: { async read() { reads += 1; return provider().read({ mount: 'secret' }); } } },
  });
  await assert.rejects(() => service.withSecret({ principalId: 'agent-1', provider: 'vault', reference: { name: 'x' } }, async () => null), (error) => error.code === 'ACTION_GUARDRAIL_DENIED');
  assert.equal(reads, 0);
});

test('SecretAccessService rejects unknown providers and only exposes provider metadata', async () => {
  const service = new SecretAccessService({ guardrail: { authorize() { return { decision: 'allow', receiptSha256: 'b'.repeat(64) }; } }, providers: {} });
  await assert.rejects(() => service.withSecret({ principalId: 'agent-1', provider: 'missing', reference: { name: 'x' } }, async () => null), (error) => error.code === 'SECRET_PROVIDER_NOT_FOUND');
  assert.deepEqual(service.listProviders(), []);
});
