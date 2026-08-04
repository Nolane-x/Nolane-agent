import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { TokenCostAdapter } from '../src/context/token-cost-adapter.mjs';
import { HarnessBpeTokenizer } from '../src/frontier-completion/harness-bpe-tokenizer.mjs';
import { ContextCacheCoherence } from '../src/frontier-completion/context-cache-coherence.mjs';
import { SemanticIndexRuntime, decodeVectorBlob } from '../src/frontier-completion/semantic-index-runtime.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');

test('HarnessBpeTokenizer performs exact model-pack BPE accounting through TokenCostAdapter', async () => {
  const tokenizer = new HarnessBpeTokenizer({
    modelId: 'forge-code-bpe-v1',
    vocab: ['l', 'o', 'w', 'e', 'r', 'lo', 'low', 'er', 'lower', 'n', 'new', 'newer', '<unk>'],
    merges: ['l o', 'lo w', 'e r', 'low er', 'n e', 'ne w', 'new er'],
  });
  const adapter = new TokenCostAdapter({ tokenizers: { 'forge-code-bpe-v1': tokenizer } });
  const result = await adapter.count('lower newer', { tokenizerId: 'forge-code-bpe-v1' });
  assert.equal(result.degraded, false);
  assert.equal(result.tokens, 2);
  assert.equal(result.tokenizerId, 'forge-code-bpe-v1');
  assert.match(tokenizer.receiptSha256, /^[a-f0-9]{64}$/);
});

test('ContextCacheCoherence invalidates on source, branch, tool schema, harness, or tokenizer drift', () => {
  const cache = new ContextCacheCoherence();
  const provenance = { sourceHash: sha('source'), branch: 'main', toolSchemaSha256: sha('tools'), harnessRevision: 'h1', tokenizerSha256: sha('tok') };
  cache.put('q1', { selected: ['a'] }, provenance);
  assert.deepEqual(cache.get('q1', provenance), { selected: ['a'] });
  for (const field of Object.keys(provenance)) {
    const changed = { ...provenance, [field]: `${provenance[field]}-changed` };
    assert.equal(cache.get('q1', changed), null, field);
  }
  assert.equal(cache.snapshot().entries, 0);
});

test('SemanticIndexRuntime batches with bounded concurrency, backpressure, cancellation and full cache key', async () => {
  let active = 0; let peak = 0; let calls = 0;
  const provider = {
    modelSha256: sha('model'), tokenizerSha256: sha('tokenizer'), dimensions: 3,
    async embed(texts, { signal } = {}) {
      calls += 1; active += 1; peak = Math.max(peak, active);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
      });
      active -= 1;
      return texts.map((text) => [text.length, 1, 2]);
    },
    async close() {},
  };
  const runtime = new SemanticIndexRuntime({ batchSize: 2, maxConcurrency: 2, maxQueuedBatches: 2 });
  const chunks = Array.from({ length: 7 }, (_, index) => ({ id: `c${index}`, content: `chunk-${index}`, contentHash: sha(`chunk-${index}`), schemaVersion: 'chunk-v2' }));
  const first = await runtime.index(chunks, { provider });
  assert.equal(first.indexed, 7);
  assert.equal(peak <= 2, true);
  assert.equal(first.cacheKeyFields.join(','), 'contentHash,modelSha256,tokenizerSha256,chunkSchema');
  const second = await runtime.index(chunks, { provider });
  assert.equal(second.cacheHits, 7);
  assert.equal(calls, 4);

  const controller = new AbortController(); controller.abort(new Error('cancelled-by-mission'));
  await assert.rejects(() => runtime.index(chunks, { provider, signal: controller.signal }), /cancelled-by-mission/);
});

test('SemanticIndexRuntime stores versioned checksummed binary quantized vectors and quarantines corruption', async () => {
  const runtime = new SemanticIndexRuntime();
  const provider = { modelSha256: sha('m'), tokenizerSha256: sha('t'), dimensions: 3, async embed() { return [[1, -2, 3]]; }, async close() {} };
  const [record] = (await runtime.index([{ id: 'x', content: 'x', contentHash: sha('x'), schemaVersion: 'v1' }], { provider })).records;
  assert.equal(Buffer.isBuffer(record.vectorBlob), true);
  const decoded = decodeVectorBlob(record.vectorBlob);
  assert.equal(decoded.version, 1);
  assert.equal(decoded.values.length, 3);
  const corrupt = Buffer.from(record.vectorBlob); corrupt[corrupt.length - 1] ^= 0xff;
  assert.throws(() => decodeVectorBlob(corrupt), /checksum/i);
  assert.equal(runtime.quarantine({ id: 'x', reason: 'corruption', blob: corrupt }).status, 'quarantined');
});

test('Semantic retrieval prioritizes exact symbol, caller, test, and type evidence before broad similarity', () => {
  const runtime = new SemanticIndexRuntime();
  const ranked = runtime.rank('AccountService', [
    { id: 'semantic', semantic: 0.99, text: 'generic account prose' },
    { id: 'type', semantic: 0.2, typeMatch: true },
    { id: 'test', semantic: 0.2, testMatch: true },
    { id: 'caller', semantic: 0.2, callerMatch: true },
    { id: 'exact', semantic: 0.1, exactSymbol: true },
  ]);
  assert.deepEqual(ranked.map((entry) => entry.id), ['exact', 'caller', 'test', 'type', 'semantic']);
});

test('SemanticIndexRuntime unloads on TTL or pressure and records peak RSS plus rssMbSeconds', async () => {
  let closed = 0;
  const runtime = new SemanticIndexRuntime({ idleTtlMs: 100, clock: () => 1_000 });
  const provider = { modelSha256: sha('m2'), tokenizerSha256: sha('t2'), dimensions: 2, async embed() { return [[1, 2]]; }, async close() { closed += 1; } };
  await runtime.index([{ id: 'a', content: 'a', contentHash: sha('a'), schemaVersion: 'v1' }], { provider, resourceSamples: [{ atMs: 0, rssMb: 100 }, { atMs: 1000, rssMb: 140 }, { atMs: 2000, rssMb: 120 }] });
  const metrics = runtime.resourceMetrics();
  assert.equal(metrics.peakRssMb, 140);
  assert.equal(metrics.rssMbSeconds, 250);
  assert.equal(await runtime.unload({ pressure: 'high', provider }), true);
  assert.equal(closed, 1);
});

test('SemanticIndexRuntime rejects NaN and dimension mismatch without caching bad vectors', async () => {
  const runtime = new SemanticIndexRuntime();
  const badNaN = { modelSha256: sha('n'), tokenizerSha256: sha('n2'), dimensions: 2, async embed() { return [[NaN, 1]]; }, async close() {} };
  await assert.rejects(() => runtime.index([{ id: 'n', content: 'n', contentHash: sha('n'), schemaVersion: 'v1' }], { provider: badNaN }), /finite/i);
  const badDimension = { modelSha256: sha('d'), tokenizerSha256: sha('d2'), dimensions: 3, async embed() { return [[1, 2]]; }, async close() {} };
  await assert.rejects(() => runtime.index([{ id: 'd', content: 'd', contentHash: sha('d'), schemaVersion: 'v1' }], { provider: badDimension }), /dimension/i);
  assert.equal(runtime.cacheSize(), 0);
});
