import assert from 'node:assert/strict';
import test from 'node:test';

import { inferModelIdentity } from '../src/model-profiles/model-identity-inference.mjs';
import { ModelProfileRegistry } from '../src/model-profiles/model-profile-registry.mjs';
import { createBuiltInModelProfiles } from '../src/model-profiles/model-profile-seeds.mjs';

function registry() {
  return new ModelProfileRegistry({ profiles: createBuiltInModelProfiles(), clock: () => '2026-08-03T00:00:00.000Z' });
}

test('identity inference distinguishes dense, MoE, parameter scale, runtime, format, and quantization', () => {
  assert.deepEqual(inferModelIdentity('Qwen/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q4_K_M'), {
    rawId: 'Qwen/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q4_K_M',
    normalizedId: 'qwen/qwen3-coder-30b-a3b-instruct-gguf:q4_k_m',
    publisher: 'qwen', family: 'qwen3-coder', series: 'qwen3',
    parameterCount: 30_000_000_000, activeParameterCount: 3_000_000_000,
    architectureType: 'moe', parameterScale: '30B-A3B',
    format: 'gguf', quantization: 'Q4_K_M', runtime: null,
    instructionTuned: true, codingSpecialized: true, reasoningSpecialized: false,
  });
  const gemma = inferModelIdentity('google/gemma-3-27b-it-Q8_0.gguf');
  assert.equal(gemma.parameterCount, 27_000_000_000);
  assert.equal(gemma.architectureType, 'dense');
  assert.equal(gemma.quantization, 'Q8_0');
  assert.equal(gemma.format, 'gguf');
  const mlx = inferModelIdentity('mlx-community/Devstral-Small-2-24B-Instruct-4bit');
  assert.equal(mlx.runtime, 'mlx');
  assert.equal(mlx.quantization, '4bit');
});

test('registry resolves exact IDs and aliases before family templates', () => {
  const profiles = registry();
  const exact = profiles.resolve({ id: 'openai/gpt-5.3-codex' });
  assert.equal(exact.canonicalId, 'openai/gpt-5.3-codex');
  assert.equal(exact.providerFamily, 'openai-api');
  assert.equal(exact.capabilities.coding, true);
  assert.equal(exact.toolCalling.supported, true);
  assert.ok(exact.quality.coding >= 4.5);

  const alias = profiles.resolve({ id: 'gpt-5.3-codex' });
  assert.equal(alias.canonicalId, exact.canonicalId);
  assert.equal(alias.resolution.kind, 'alias');

  const qwen = profiles.resolve({ id: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' });
  assert.equal(qwen.architecture.totalParameters, 30_000_000_000);
  assert.equal(qwen.architecture.activeParameters, 3_000_000_000);
  assert.equal(qwen.architecture.type, 'moe');
  assert.equal(qwen.capabilities.coding, true);
  assert.equal(qwen.capabilities.toolCalling, true);
  assert.ok(qwen.specialties.includes('agentic-coding'));
});

test('family resolution covers 27B, 30B, 32B, 70B, and arbitrary local coding models', () => {
  const profiles = registry();
  const ids = [
    ['acme/code-model-27b-instruct', 27_000_000_000],
    ['acme/code-model-30b-a5b-instruct-awq', 30_000_000_000],
    ['acme/code-model-32b-instruct-gptq', 32_000_000_000],
    ['acme/code-model-70b-instruct-q4_k_m.gguf', 70_000_000_000],
  ];
  for (const [id, expected] of ids) {
    const profile = profiles.resolve({ id, providerFamily: 'generic-local' });
    assert.equal(profile.architecture.totalParameters, expected);
    assert.equal(profile.capabilities.coding, true);
    assert.equal(profile.deployment.local, true);
    assert.ok(profile.localRequirements.estimatedRamGB > 0);
    assert.equal(profile.provenance.confidence.overall <= 0.7, true);
  }
});

test('quantization changes deployment estimates without changing base-model identity', () => {
  const profiles = registry();
  const fp16 = profiles.resolve({ id: 'Qwen/Qwen2.5-Coder-32B-Instruct', deployment: { quantization: 'fp16' } });
  const q4 = profiles.resolve({ id: 'Qwen/Qwen2.5-Coder-32B-Instruct-GGUF-Q4_K_M' });
  assert.equal(fp16.architecture.totalParameters, q4.architecture.totalParameters);
  assert.equal(q4.architecture.quantization, 'Q4_K_M');
  assert.ok(q4.localRequirements.estimatedRamGB < fp16.localRequirements.estimatedRamGB);
  assert.ok(q4.warnings.some((warning) => warning.code === 'quantization-capability-variance'));
});

test('unknown models are conservative, explicit, and never invent prices or token limits', () => {
  const profile = registry().resolve({ id: 'future-lab/unknown-model-x', providerFamily: 'openai-compatible' });
  assert.equal(profile.resolution.kind, 'provisional');
  assert.equal(profile.context.contextWindow, null);
  assert.equal(profile.context.maxOutputTokens, null);
  assert.equal(profile.pricing.inputPerMillion, null);
  assert.equal(profile.toolCalling.supported, null);
  assert.ok(profile.warnings.some((warning) => warning.code === 'unverified-model'));
  assert.ok(profile.provenance.confidence.overall < 0.5);
});

test('discovered metadata overrides family defaults but not authoritative exact fields', () => {
  const profiles = registry();
  profiles.registerDiscovered({
    id: 'anthropic/claude-opus-5', providerFamily: 'anthropic-api', providerModelId: 'claude-opus-5',
    context: { contextWindow: 300_000, maxOutputTokens: 64_000 },
    toolCalling: { supported: true, parallel: true, strictSchema: true },
    source: { type: 'provider-api', providerId: 'anthropic-api', observedAt: '2026-08-03T00:00:00.000Z' },
  });
  const exact = profiles.resolve({ id: 'claude-opus-5' });
  assert.equal(exact.context.contextWindow, 300_000);
  assert.equal(exact.identity.publisher, 'anthropic');
  assert.equal(exact.capabilities.coding, true);
  assert.equal(exact.provenance.sources.some((source) => source.type === 'provider-api'), true);
});

test('deprecated profiles expose replacement warnings and compatibility reports', () => {
  const profiles = registry();
  const old = profiles.resolve({ id: 'openai/gpt-4o' });
  assert.equal(old.lifecycle.status, 'deprecated');
  assert.ok(old.lifecycle.replacement);
  assert.ok(old.warnings.some((warning) => warning.code === 'model-deprecated'));

  const report = profiles.compatibility({
    id: 'google/gemma-3-27b-it', providerFamily: 'generic-local',
    requirements: { toolCalling: true, structuredOutput: true, minContextWindow: 100_000, maxRamGB: 16 },
  });
  assert.equal(report.compatible, false);
  assert.ok(report.blockers.length >= 1);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('profiles and exports are deeply immutable and deterministic', () => {
  const profiles = registry();
  const profile = profiles.resolve({ id: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' });
  assert.throws(() => { profile.specialties.push('mutate'); }, TypeError);
  assert.throws(() => { profile.toolCalling.supported = false; }, TypeError);
  const first = profiles.exportCatalog();
  const second = profiles.exportCatalog();
  assert.deepEqual(first, second);
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
  assert.ok(first.profiles.length >= 500);
  assert.ok(first.families.length >= 70);
});


test('built-in catalog spans tiny local models through current frontier families', () => {
  const profiles = registry();
  const tiny = profiles.resolve({ id: 'qwen/qwen3-0.6b' });
  const twoB = profiles.resolve({ id: 'google-gemma/gemma-2-2b-it' });
  const fourB = profiles.resolve({ id: 'qwen/qwen3-4b' });
  const sevenB = profiles.resolve({ id: 'qwen/qwen2.5-coder-7b-instruct' });
  const frontier = ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'moonshotai/kimi-k3', 'anthropic/claude-opus-5'];
  assert.equal(tiny.taskEnvelope.maximumClass, 'micro');
  assert.equal(twoB.taskEnvelope.maximumClass, 'micro');
  assert.equal(fourB.taskEnvelope.maximumClass, 'small');
  assert.equal(sevenB.capabilities.coding, true);
  for (const id of frontier) assert.equal(profiles.resolve({ id }).resolution.kind, 'exact');
});
