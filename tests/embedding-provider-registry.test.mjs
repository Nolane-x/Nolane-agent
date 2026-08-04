import assert from 'node:assert/strict';
import test from 'node:test';

import { EmbeddingProviderRegistry, FeatureHashEmbeddingProvider } from '../src/repository/embedding-provider.mjs';

function provider({ id, kind = 'neural', degraded = false, dimensions = 3, available = true } = {}) {
  return {
    id,
    kind,
    degraded,
    dimensions,
    modelSha256: kind === 'neural' ? 'a'.repeat(64) : null,
    available: async () => available,
    async embed(texts, { signal } = {}) {
      if (signal?.aborted) throw signal.reason ?? new Error('aborted');
      return texts.map(() => Array(dimensions).fill(kind === 'neural' ? 1 : 0));
    },
  };
}

test('EmbeddingProviderRegistry prefers an available neural provider and exposes immutable status', async () => {
  const registry = new EmbeddingProviderRegistry();
  registry.register(new FeatureHashEmbeddingProvider({ dimensions: 32 }));
  registry.register(provider({ id: 'neural-code-v1' }));

  const resolved = await registry.resolve({ preferNeural: true, allowFallback: true });
  assert.equal(resolved.provider.id, 'neural-code-v1');
  assert.equal(resolved.degraded, false);
  assert.equal(resolved.reason, 'neural-available');
  const status = await registry.status();
  assert.equal(status.providers.length, 2);
  assert.equal(status.providers.find((item) => item.id === 'neural-code-v1').available, true);
  assert.equal(Object.isFrozen(status), true);
  assert.equal(Object.isFrozen(status.providers), true);
});

test('EmbeddingProviderRegistry reports explicit degraded fallback when neural provider is unavailable', async () => {
  const registry = new EmbeddingProviderRegistry();
  registry.register(new FeatureHashEmbeddingProvider({ dimensions: 32 }));
  registry.register(provider({ id: 'neural-unavailable', available: false }));

  const resolved = await registry.resolve({ preferNeural: true, allowFallback: true });
  assert.equal(resolved.provider.kind, 'feature-hash');
  assert.equal(resolved.degraded, true);
  assert.equal(resolved.reason, 'neural-unavailable-fallback');
  await assert.rejects(() => registry.resolve({ preferNeural: true, allowFallback: false }), (error) => error?.code === 'NEURAL_EMBEDDING_UNAVAILABLE');
});

test('EmbeddingProviderRegistry rejects duplicate IDs and invalid batches', async () => {
  const registry = new EmbeddingProviderRegistry();
  const neural = provider({ id: 'neural-code-v1' });
  registry.register(neural);
  assert.throws(() => registry.register(neural), /already registered/i);
  const resolved = await registry.resolve();
  await assert.rejects(() => resolved.provider.embed('not-an-array'), /array/i);
});
