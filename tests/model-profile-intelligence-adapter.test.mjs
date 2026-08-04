import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelProfileRegistry } from '../src/providers/model-profile-registry.mjs';
import { advancedProfileToLegacyPatch, canonicalModelId, legacyDiscoveryToAdvancedRecord } from '../src/model-management/model-profile-adapter.mjs';

test('adapter preserves canonical identity and conservative unknowns', () => {
  assert.equal(canonicalModelId('openai-api', 'gpt-5.3-codex'), 'openai/gpt-5.3-codex');
  const discovered = legacyDiscoveryToAdvancedRecord({ modelId: 'custom-7b-q4', kind: 'ollama', contextLength: 32_000, capabilities: { tools: true }, local: { quantization: 'q4' } }, { providerId: 'ollama' });
  assert.equal(discovered.id, 'ollama/custom-7b-q4');
  assert.equal(discovered.deployment.local, true);
  assert.equal(discovered.toolCalling.supported, true);
});

test('compatibility registry enriches old API records with full intelligence dossiers', () => {
  const registry = new ModelProfileRegistry();
  const record = registry.upsert({ providerId: 'openai-api', modelId: 'gpt-5.3-codex' });
  assert.equal(record.metadata.canonicalId, 'openai/gpt-5.3-codex');
  assert.equal(record.capabilities.tools, true);
  assert.equal(record.intelligence.canonicalId, 'openai/gpt-5.3-codex');
  assert.equal(registry.publicView().intelligence.exactProfiles >= 500, true);
  const legacy = advancedProfileToLegacyPatch(record.intelligence, { providerId: 'openai-api', modelId: 'gpt-5.3-codex' });
  assert.equal(legacy.capabilities.structuredOutput, true);
});
