import assert from 'node:assert/strict';
import test from 'node:test';

import { ModelProfileRegistry } from '../src/model-profiles/model-profile-registry.mjs';
import { normalizeModelProfile } from '../src/model-profiles/model-profile-schema.mjs';
import { ModelTruthPlane } from '../src/model-profiles/model-truth-plane.mjs';
import { ModelTruthStore } from '../src/model-profiles/model-truth-store.mjs';

function registry() {
  return new ModelProfileRegistry({ profiles: [normalizeModelProfile({
    canonicalId: 'acme/model-a', aliases: ['model-a'], providerFamily: 'acme-api', providerModelId: 'model-a',
    identity: { publisher: 'acme', family: 'model', displayName: 'Model A' }, lifecycle: { status: 'stable' },
    context: { contextWindow: 32_000 }, capabilities: { coding: true, structuredOutput: true }, toolCalling: { supported: true },
    pricing: { inputPerMillion: 1 }, deployment: { local: false, remote: true }, provenance: { confidence: { overall: 0.9 } },
  }), normalizeModelProfile({
    canonicalId: 'acme/model-b', providerFamily: 'acme-api', providerModelId: 'model-b', identity: { publisher: 'acme', family: 'model' },
    context: { contextWindow: 64_000 }, capabilities: { coding: true }, toolCalling: { supported: null }, deployment: { local: false, remote: true },
  })], clock: () => '2026-08-04T00:00:00.000Z' });
}

test('truth plane creates canonical entities and ingests scoped discovery facts', () => {
  const plane = new ModelTruthPlane({ registry: registry(), store: new ModelTruthStore({ clock: () => '2026-08-04T00:00:00.000Z' }), clock: () => '2026-08-04T00:00:00.000Z' });
  plane.recordDiscoveryBatch({ providerFamily: 'acme-api', register: true, models: [{ id: 'acme/model-a', providerFamily: 'acme-api', providerModelId: 'model-a', context: { maxOutputTokens: 12_000 }, source: { type: 'provider-api', providerId: 'acme-api', observedAt: '2026-08-04T00:00:00.000Z' } }] });
  const view = plane.entities('model-a');
  assert.equal(view.bundle.baseModel.schema, 'nolane.model-base.v1');
  assert.equal(view.facts.facts.find((item) => item.path === 'context.maxOutputTokens').selected.value, 12_000);
  assert.equal(plane.snapshot().truth.discoveries, 1);
});

test('truth plane compares deployment profiles rather than collapsing them to family names', () => {
  const plane = new ModelTruthPlane({ registry: registry(), store: new ModelTruthStore(), clock: () => '2026-08-04T00:00:00.000Z' });
  const comparison = plane.compare(['acme/model-a', 'acme/model-b']);
  assert.equal(comparison.rows.length, 2);
  assert.equal(comparison.rows[0].context.contextWindow, 32_000);
  assert.equal(comparison.rows[1].context.contextWindow, 64_000);
  assert.match(comparison.receiptSha256, /^[a-f0-9]{64}$/);
});
