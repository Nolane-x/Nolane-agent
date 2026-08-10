import assert from 'node:assert/strict';
import test from 'node:test';

import { ModelDiscoveryService } from '../src/model-profiles/model-discovery-service.mjs';

function response(json, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, headers: new Map(), async text() { return JSON.stringify(json); } };
}

test('discovers OpenAI-compatible models and preserves provider IDs', async () => {
  const fetch = async (url, options) => {
    assert.match(url, /\/v1\/models$/);
    assert.equal(options.headers.Authorization, 'Bearer secret');
    return response({ data: [{ id: 'gpt-5.2', created: 1, owned_by: 'openai' }, { id: 'custom-code-7b' }] });
  };
  const service = new ModelDiscoveryService({ fetch, clock: () => '2026-08-03T00:00:00.000Z' });
  const result = await service.discover({ providerFamily: 'openai-api', baseUrl: 'https://api.example.test', apiKey: 'secret' });
  assert.equal(result.models.length, 2);
  assert.equal(result.models[0].providerModelId, 'gpt-5.2');
  assert.equal(result.models[0].source.type, 'provider-api');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('accepts provider connection metadata without duplicating versioned base paths', async () => {
  const fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:1234/v1/models');
    assert.equal(options.headers['x-provider-header'], 'present');
    return response({ data: [{ id: 'local-model' }] });
  };
  const service = new ModelDiscoveryService({ fetch });
  const result = await service.discover({ providerId: 'local-models', kind: 'openai-compatible', baseUrl: 'http://127.0.0.1:1234/v1', headers: { 'x-provider-header': 'present' } });
  assert.equal(result.providerFamily, 'local-models');
  assert.equal(result.models[0].providerModelId, 'local-model');
});

test('maps Anthropic provider kind and preserves caller auth headers', async () => {
  const fetch = async (url, options) => {
    assert.equal(url, 'https://api.anthropic.test/v1/models');
    assert.equal(options.headers['x-api-key'], 'secret');
    assert.equal(options.headers['anthropic-version'], '2023-06-01');
    return response({ data: [{ id: 'claude-sonnet-4-7' }], has_more: false });
  };
  const service = new ModelDiscoveryService({ fetch });
  const result = await service.discover({ providerId: 'anthropic-api', kind: 'anthropic-messages', baseUrl: 'https://api.anthropic.test/v1', apiKey: 'secret' });
  assert.equal(result.providerFamily, 'anthropic-api');
  assert.equal(result.models[0].id, 'anthropic/claude-sonnet-4-7');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('paginates Anthropic and Gemini discovery', async () => {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (url.includes('anthropic')) {
      return calls.filter((x) => x.includes('anthropic')).length === 1
        ? response({ data: [{ id: 'claude-opus-5', display_name: 'Claude Opus 5' }], has_more: true, last_id: 'one' })
        : response({ data: [{ id: 'claude-sonnet-4-7' }], has_more: false });
    }
    return calls.filter((x) => x.includes('google')).length === 1
      ? response({ models: [{ name: 'models/gemini-3.1-flash', inputTokenLimit: 1_000_000, outputTokenLimit: 65_536, supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'next' })
      : response({ models: [{ name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] }] });
  };
  const service = new ModelDiscoveryService({ fetch, clock: () => '2026-08-03T00:00:00.000Z' });
  const anthropic = await service.discover({ providerFamily: 'anthropic-api', baseUrl: 'https://api.anthropic.test', apiKey: 'x' });
  const gemini = await service.discover({ providerFamily: 'google-api', baseUrl: 'https://generativelanguage.googleapis.test', apiKey: 'x' });
  assert.equal(anthropic.models.length, 2);
  assert.equal(gemini.models.length, 2);
  assert.equal(gemini.models[0].context.contextWindow, 1_000_000);
  assert.equal(gemini.models[1].capabilities.embeddings, true);
});

test('discovers Ollama and LM Studio deployment metadata', async () => {
  const fetch = async (url) => url.includes('/api/tags')
    ? response({ models: [{ name: 'qwen3:4b-q4_K_M', size: 2_700_000_000, details: { family: 'qwen3', parameter_size: '4.0B', quantization_level: 'Q4_K_M', format: 'gguf' } }] })
    : response({ data: [{ id: 'mlx-community/Devstral-Small-2-24B-Instruct-4bit', arch: 'mistral', quantization: '4bit', loaded_instances: 1 }] });
  const service = new ModelDiscoveryService({ fetch, clock: () => '2026-08-03T00:00:00.000Z' });
  const ollama = await service.discover({ providerFamily: 'ollama', baseUrl: 'http://127.0.0.1:11434' });
  const lmstudio = await service.discover({ providerFamily: 'lm-studio', baseUrl: 'http://127.0.0.1:1234' });
  assert.equal(ollama.models[0].architecture.quantization, 'Q4_K_M');
  assert.equal(ollama.models[0].architecture.totalParameters, 4_000_000_000);
  assert.equal(ollama.models[0].deployment.local, true);
  assert.equal(lmstudio.models[0].architecture.runtime, 'mlx');
});

test('rejects oversized and malformed discovery responses safely', async () => {
  const service = new ModelDiscoveryService({ fetch: async () => ({ ok: true, status: 200, async text() { return 'x'.repeat(2048); } }), maxResponseBytes: 1024 });
  await assert.rejects(() => service.discover({ providerFamily: 'openai-api', baseUrl: 'https://api.test' }), /response exceeds/i);
});
