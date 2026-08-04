import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelProfileRegistry } from '../src/model-profiles/model-profile-registry.mjs';
import { normalizeModelProfile } from '../src/model-profiles/model-profile-schema.mjs';
import { ModelManagementService } from '../src/model-management/model-management-service.mjs';

function makeProfile(id, providerFamily, quality, price, options = {}) {
  return normalizeModelProfile({
    canonicalId: id, providerFamily, providerModelId: id.split('/').at(-1),
    identity: { publisher: id.split('/')[0], family: id.split('/')[1].split('-')[0], displayName: id },
    lifecycle: { status: 'stable' }, context: { contextWindow: 128_000, maxInputTokens: 128_000, maxOutputTokens: 16_000 },
    capabilities: { coding: true, reasoning: true, structuredOutput: true, streaming: true },
    toolCalling: { supported: true, parallel: true, strictSchema: true },
    quality: { coding: quality, reasoning: quality, debugging: quality, largeRefactor: quality, toolUse: quality, instructionFollowing: quality },
    taskEnvelope: { maximumClass: 'frontier', verificationRequired: true },
    pricing: { inputPerMillion: price, outputPerMillion: price * 4 },
    deployment: { local: options.local === true, remote: options.local !== true },
    localRequirements: options.local ? { estimatedRamGB: 12 } : {},
    provenance: { confidence: { overall: 0.95, identity: 1, capabilities: 0.95, limits: 0.9, pricing: 0.9 } },
    resolution: { kind: 'exact', matchedBy: id },
  });
}

function service() {
  const registry = new ModelProfileRegistry({ profiles: [
    makeProfile('alpha/code-max', 'alpha-api', 4.9, 3),
    makeProfile('beta/code-balanced', 'beta-api', 4.5, 1),
    makeProfile('local/code-14b', 'ollama', 3.8, 0, { local: true }),
  ], clock: () => '2026-08-03T02:00:00.000Z' });
  return new ModelManagementService({
    registry,
    clock: () => '2026-08-03T02:00:00.000Z',
    providerInventory: () => [
      { id: 'alpha-api', available: true, authenticated: true, healthy: true },
      { id: 'beta-api', available: true, authenticated: true, healthy: true },
      { id: 'ollama', available: true, authenticated: true, healthy: true },
    ],
  });
}

test('manager selects and explains a model with provider-diverse fallbacks', () => {
  const manager = service();
  manager.recordExecution('alpha/code-max', { success: true, latencyMs: 850, quality: 0.98, costUsd: 0.02 });
  const recommendation = manager.select({ request: { taskClass: 'large', requiredCapabilities: ['coding', 'toolCalling', 'structuredOutput'], expectedInputTokens: 20_000, expectedOutputTokens: 4_000, preferLocal: false, weights: { quality: 0.82, reliability: 0.1, cost: 0.02, latency: 0.02, confidence: 0.04, locality: 0, lifecycle: 0 } } });
  assert.equal(recommendation.selected.modelId, 'alpha/code-max');
  assert.ok(recommendation.fallbacks.some((item) => item.providerFamily === 'beta-api'));
  assert.ok(recommendation.candidates.every((item) => item.evaluationReceiptSha256));
});

test('manager builds role portfolio, detailed dossier, and compact snapshot', () => {
  const manager = service();
  const portfolio = manager.createPortfolio({ roles: {
    primary: { requiredCapabilities: ['coding', 'toolCalling'] },
    local: { requiredCapabilities: ['coding'], localOnly: true },
  } });
  assert.equal(portfolio.assignments.local.selected.modelId, 'local/code-14b');
  const dossier = manager.dossier('beta/code-balanced', { request: { requiredCapabilities: ['coding'] } });
  assert.equal(dossier.canonicalId, 'beta/code-balanced');
  assert.ok(dossier.capabilities.verified.includes('coding'));
  assert.match(dossier.receiptSha256, /^[a-f0-9]{64}$/);
  const snapshot = manager.snapshot();
  assert.equal(snapshot.summary.exactProfiles, 3);
  assert.equal(snapshot.summary.providers, 3);
});
