import assert from 'node:assert/strict';
import test from 'node:test';

import { TokenCostAdapter } from '../src/context/token-cost-adapter.mjs';

test('TokenCostAdapter uses an injected provider tokenizer and labels the count exact', async () => {
  const adapter = new TokenCostAdapter();
  adapter.register('openai-o200k', { async count(text) { return text.split(/\s+/).filter(Boolean).length; } });
  const result = await adapter.count('one two three', { tokenizerId: 'openai-o200k' });
  assert.deepEqual(result, { tokens: 3, method: 'provider-tokenizer', tokenizerId: 'openai-o200k', degraded: false });
});

test('TokenCostAdapter batches through a tokenizer batch contract', async () => {
  let batchCalls = 0;
  const adapter = new TokenCostAdapter({ tokenizers: {
    'code-int8': {
      async countBatch(texts) { batchCalls += 1; return texts.map((text) => text.length); },
    },
  } });
  const results = await adapter.countBatch(['a', 'abcd'], { tokenizerId: 'code-int8' });
  assert.equal(batchCalls, 1);
  assert.deepEqual(results.map((item) => item.tokens), [1, 4]);
  assert.ok(results.every((item) => item.degraded === false));
});

test('TokenCostAdapter deterministic fallback is never labeled exact', async () => {
  const adapter = new TokenCostAdapter();
  const a = await adapter.count('abcdef', { tokenizerId: 'missing' });
  const b = await adapter.count('abcdef', { tokenizerId: 'missing' });
  assert.deepEqual(a, b);
  assert.equal(a.degraded, true);
  assert.equal(a.method, 'deterministic-fallback');
  assert.equal(a.tokenizerId, 'forge-utf8-quarter-v1');
  assert.ok(a.tokens > 0);
});

test('TokenCostAdapter honors cancellation before tokenizer work begins', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled by mission'));
  const adapter = new TokenCostAdapter({ tokenizers: { exact: { async count() { throw new Error('must not run'); } } } });
  await assert.rejects(() => adapter.count('text', { tokenizerId: 'exact' }, { signal: controller.signal }), /cancelled by mission/);
});

test('TokenCostAdapter rejects invalid tokenizer output instead of silently claiming exactness', async () => {
  const adapter = new TokenCostAdapter({ tokenizers: { broken: { async count() { return -2; } } } });
  await assert.rejects(() => adapter.count('text', { tokenizerId: 'broken' }), /invalid token count/i);
});
