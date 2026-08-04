import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('ProviderRegistry admits complete calls through one stable execution-pool proxy', async () => {
  const calls = [];
  let releaseFirst;
  const pool = {
    async run(input, fn) {
      calls.push(input);
      if (calls.length === 1) await new Promise((resolve) => { releaseFirst = resolve; });
      return fn({ key: input.key });
    },
  };
  const raw = {
    id: 'claude',
    publicView: () => ({ id: 'claude', capabilities: ['coding'] }),
    async detect() { return { id: 'claude', available: true }; },
    async complete(input) { return { providerId: 'claude', text: input.messages[0].content, sawLeaseContext: Object.hasOwn(input, 'leaseContext') }; },
  };
  const registry = new ProviderRegistry({ executionPool: pool });
  const registered = registry.register(raw);
  assert.equal(registered, registry.get('claude'));
  assert.equal(registry.list()[0], registered);
  assert.equal(await registered.detect().then((item) => item.available), true);
  const first = registered.complete({ messages: [{ role: 'user', content: 'one' }], leaseContext: { missionId: 'm1', taskId: 't1', role: 'executor' } });
  await tick();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { key: 'claude', missionId: 'm1', taskId: 't1', signal: null, metadata: { role: 'executor' } });
  releaseFirst();
  const result = await first;
  assert.equal(result.text, 'one');
  assert.equal(result.sawLeaseContext, false);
});

test('ProviderRegistry keeps raw provider identity available and refreshes proxies on upsert', async () => {
  const pool = { run: async (_input, fn) => fn({}) };
  const registry = new ProviderRegistry({ executionPool: pool });
  const firstRaw = { id: 'p', publicView: () => ({ id: 'p' }), complete: async () => ({ text: 'first' }) };
  const firstProxy = registry.register(firstRaw);
  assert.equal(registry.raw('p'), firstRaw);
  const secondRaw = { id: 'p', publicView: () => ({ id: 'p' }), complete: async () => ({ text: 'second' }) };
  const secondProxy = registry.upsert(secondRaw);
  assert.notEqual(firstProxy, secondProxy);
  assert.equal(registry.raw('p'), secondRaw);
  assert.equal((await registry.get('p').complete({})).text, 'second');
});
