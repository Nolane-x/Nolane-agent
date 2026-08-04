import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeModelProfile } from '../src/model-profiles/model-profile-schema.mjs';
import { ModelPolicyEngine } from '../src/model-management/model-policy-engine.mjs';

function profile(overrides = {}) {
  return normalizeModelProfile({
    canonicalId: 'acme/code-pro', providerFamily: 'acme-api', providerModelId: 'code-pro',
    identity: { publisher: 'acme', family: 'code', displayName: 'Code Pro' },
    lifecycle: { status: 'stable' },
    context: { contextWindow: 128_000, maxInputTokens: 128_000, maxOutputTokens: 16_000 },
    capabilities: { coding: true, reasoning: true, structuredOutput: true, streaming: true },
    toolCalling: { supported: true, parallel: true, strictSchema: true },
    quality: { coding: 4.8, reasoning: 4.5, debugging: 4.7, largeRefactor: 4.5, toolUse: 4.8, instructionFollowing: 4.6 },
    taskEnvelope: { maximumClass: 'frontier', verificationRequired: true },
    pricing: { inputPerMillion: 2, outputPerMillion: 8 },
    deployment: { local: false, remote: true },
    provenance: { confidence: { overall: 0.95, identity: 1, capabilities: 0.95, limits: 0.9, pricing: 0.9 } },
    resolution: { kind: 'exact', matchedBy: 'acme/code-pro' },
    ...overrides,
  });
}

test('policy engine fails closed for unverified capabilities and hard budgets', () => {
  const engine = new ModelPolicyEngine();
  const uncertain = profile({ canonicalId: 'acme/uncertain', capabilities: { coding: true, structuredOutput: null }, toolCalling: { supported: null } });
  const result = engine.evaluate(uncertain, { request: { requiredCapabilities: ['toolCalling', 'structuredOutput'], maxCostUsd: 0.001, expectedInputTokens: 10_000, expectedOutputTokens: 2_000 } });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.some((item) => item.code === 'capability-toolCalling'));
  assert.ok(result.blockers.some((item) => item.code === 'capability-structuredOutput'));
  assert.ok(result.blockers.some((item) => item.code === 'cost-budget-exceeded-or-unknown'));
  assert.equal(result.score, 0);
});

test('policy engine scores an eligible model with explainable components', () => {
  const engine = new ModelPolicyEngine();
  const result = engine.evaluate(profile(), {
    health: { status: 'healthy', reliability: 0.99, latencyMs: { p95: 900 }, receiptSha256: 'a'.repeat(64) },
    availability: { available: true, authenticated: true, healthy: true },
    request: { taskClass: 'large', requiredCapabilities: ['coding', 'toolCalling', 'structuredOutput'], expectedInputTokens: 20_000, expectedOutputTokens: 4_000, maxCostUsd: 0.2, maxLatencyMs: 2_000 },
  });
  assert.equal(result.eligible, true);
  assert.ok(result.score > 0.7);
  assert.ok(result.estimatedCostUsd > 0);
  assert.equal(result.components.reliability, 0.99);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});
