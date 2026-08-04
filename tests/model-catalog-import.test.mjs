import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeLiteLlmCatalog,
  normalizeModelsDevCatalog,
  normalizeOpenRouterCatalog,
  normalizePortkeyCatalog,
} from '../src/model-profiles/model-catalog-import.mjs';

test('models.dev import separates base model identity from provider deployment', () => {
  const records = normalizeModelsDevCatalog({
    openrouter: {
      id: 'openrouter',
      models: {
        'deepseek/deepseek-v4-flash': {
          id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', family: 'deepseek-v4',
          base_model: 'deepseek/deepseek-v4-flash', reasoning: true, tool_call: true,
          modalities: { input: ['text'], output: ['text'] },
          limit: { context: 1_048_576, output: 384_000 },
          cost: { input: 0.00000022, output: 0.00000088 },
        },
      },
    },
  }, { observedAt: '2026-08-03T00:00:00.000Z' });
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'deepseek/deepseek-v4-flash');
  assert.equal(records[0].baseModelId, 'deepseek/deepseek-v4-flash');
  assert.equal(records[0].providerFamily, 'openrouter');
  assert.equal(records[0].context.contextWindow, 1_048_576);
  assert.equal(records[0].pricing.inputPerMillion, 0.22);
  assert.equal(records[0].toolCalling.supported, true);
});

test('OpenRouter import captures operational capabilities and nullable pricing', () => {
  const records = normalizeOpenRouterCatalog({ data: [{
    id: 'qwen/qwen3.7-flash', name: 'Qwen3.7 Flash', context_length: 1_000_000,
    architecture: { input_modalities: ['text', 'image', 'video'], output_modalities: ['text'] },
    top_provider: { max_completion_tokens: 131_072 },
    supported_parameters: ['tools', 'tool_choice', 'structured_outputs', 'reasoning', 'include_reasoning'],
    pricing: { prompt: '0.0000001', completion: '0.0000004', input_cache_read: '0.00000002' },
  }] }, { observedAt: '2026-08-03T00:00:00.000Z' });
  assert.equal(records[0].context.maxOutputTokens, 131_072);
  assert.equal(records[0].modalities.input.video, true);
  assert.equal(records[0].toolCalling.supported, true);
  assert.equal(records[0].capabilities.structuredOutput, true);
  assert.equal(records[0].reasoning.supported, true);
  assert.equal(records[0].pricing.cachedInputPerMillion, 0.02);
});

test('LiteLLM and Portkey imports accept large provider maps without fabricating missing limits', () => {
  const litellm = normalizeLiteLlmCatalog({
    'ollama/qwen3:4b': { litellm_provider: 'ollama', mode: 'chat', supports_function_calling: true, max_input_tokens: 32_768 },
  });
  assert.equal(litellm[0].providerFamily, 'ollama');
  assert.equal(litellm[0].context.contextWindow, 32_768);
  assert.equal(litellm[0].context.maxOutputTokens, null);

  const portkey = normalizePortkeyCatalog({ providers: [{ id: 'groq', models: [{ id: 'llama-3.1-8b-instant', context_window: 131_072 }] }] });
  assert.equal(portkey[0].providerFamily, 'groq');
  assert.equal(portkey[0].providerModelId, 'llama-3.1-8b-instant');
  assert.equal(portkey[0].pricing.inputPerMillion, null);
});
