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

test('compatibility registry preserves discovered per-model reasoning controls for the composer', () => {
  const registry = new ModelProfileRegistry();

  const [profile] = registry.mergeDiscovery('codex-app-server', [{
    id: 'gpt-5.6-sol',
    reasoning: {
      supported: true,
      controllable: true,
      levels: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultLevel: 'high',
    },
  }]);

  assert.deepEqual(profile.reasoning, {
    supported: true,
    controllable: true,
    levels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultLevel: 'high',
  });
  assert.deepEqual(registry.publicView().models[0].reasoning, profile.reasoning);
});

test('compatibility registry preserves provider-declared effort controls over inferred family defaults', () => {
  const registry = new ModelProfileRegistry();
  const [profile] = registry.mergeDiscovery('openai-picker', [{
    id: 'gpt-5.6',
    reasoning: { supported: true, controllable: true, levels: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
    metadata: { effort: { provenance: 'provider-declared', transport: 'forwarded', modelCompatibility: 'provider-validated-at-execution' } },
  }]);

  assert.deepEqual(profile.reasoning.levels, ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(profile.reasoning.controllable, true);
  assert.deepEqual(profile.metadata.effort, { provenance: 'provider-declared', transport: 'forwarded', modelCompatibility: 'provider-validated-at-execution' });
});
