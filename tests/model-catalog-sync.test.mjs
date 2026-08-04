import assert from 'node:assert/strict';
import test from 'node:test';

import { ModelCatalogSyncService } from '../src/model-profiles/model-catalog-sync.mjs';

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(payload); } };
}

test('sync merges multiple catalogs while preserving source-specific deployments', async () => {
  const fetch = async (url) => {
    if (url.includes('models.dev')) return response({ openrouter: { id: 'openrouter', models: { 'deepseek/deepseek-v4-flash': { id: 'deepseek/deepseek-v4-flash', base_model: 'deepseek/deepseek-v4-flash', limit: { context: 1_000_000 } } } } });
    if (url.includes('openrouter')) return response({ data: [{ id: 'qwen/qwen3.7-flash', context_length: 1_000_000, supported_parameters: ['tools'] }] });
    throw new Error('unexpected URL');
  };
  const service = new ModelCatalogSyncService({ fetch, clock: () => '2026-08-03T00:00:00.000Z' });
  const result = await service.sync({ sources: ['models.dev', 'openrouter'] });
  assert.equal(result.records.length, 2);
  assert.equal(result.sources.length, 2);
  assert.equal(result.failures.length, 0);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('sync records source failures without discarding successful catalogs', async () => {
  const service = new ModelCatalogSyncService({ fetch: async (url) => url.includes('models.dev') ? response({}) : response({ error: 'down' }, 503) });
  const result = await service.sync({ sources: ['models.dev', 'openrouter'] });
  assert.equal(result.sources.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(JSON.stringify(result).includes('authorization'), false);
});
