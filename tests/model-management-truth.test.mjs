import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ModelManagementService } from '../src/model-management/model-management-service.mjs';
import { ModelProfileRegistry } from '../src/model-profiles/model-profile-registry.mjs';
import { normalizeModelProfile } from '../src/model-profiles/model-profile-schema.mjs';
import { ModelTruthPlane } from '../src/model-profiles/model-truth-plane.mjs';
import { ModelTruthStore } from '../src/model-profiles/model-truth-store.mjs';

function setup() {
  const profiles = ['a', 'b'].map((id, index) => normalizeModelProfile({
    canonicalId: `acme/${id}`, providerFamily: `provider-${id}`, providerModelId: id,
    identity: { publisher: 'acme', family: id, displayName: id.toUpperCase() }, lifecycle: { status: 'stable' },
    context: { contextWindow: 32_000 * (index + 1), maxOutputTokens: 8_000 },
    capabilities: { coding: true, structuredOutput: true }, toolCalling: { supported: true, strictSchema: true },
    quality: { coding: 4 + index / 2 }, pricing: { inputPerMillion: index + 1, outputPerMillion: (index + 1) * 4 },
    deployment: { local: false, remote: true }, provenance: { confidence: { overall: 0.9, capabilities: 0.9, limits: 0.9, pricing: 0.9 } },
    taskEnvelope: { maximumClass: 'large', verificationRequired: true },
  }));
  const registry = new ModelProfileRegistry({ profiles, clock: () => '2026-08-04T00:00:00.000Z' });
  const truthPlane = new ModelTruthPlane({ registry, store: new ModelTruthStore({ clock: () => '2026-08-04T00:00:00.000Z' }), clock: () => '2026-08-04T00:00:00.000Z' });
  const manager = new ModelManagementService({ registry, truthPlane, clock: () => '2026-08-04T00:00:00.000Z', providerInventory: () => [{ id: 'provider-a', available: true, authenticated: true, healthy: true }, { id: 'provider-b', available: true, authenticated: true, healthy: true }] });
  return { manager, truthPlane };
}

test('management plane reads canonical entities and records durable execution observations', () => {
  const { manager } = setup();
  manager.recordExecution('acme/a', { success: true, latencyMs: 120, inputTokens: 10, outputTokens: 4, structuredOutputValid: true });
  const dossier = manager.dossier('acme/a');
  assert.equal(dossier.truth.bundle.baseModel.schema, 'nolane.model-base.v1');
  assert.equal(dossier.truth.runtimeObservations.length, 1);
  assert.equal(manager.truthSnapshot().schema, 'nolane.model-truth-plane.v1');
});

test('management plane compares deployments, stores eval identity, and explains routing', () => {
  const { manager } = setup();
  const evaluation = manager.recordEvaluation({ modelId: 'acme/a', suiteId: 'tool-conformance', suiteVersion: '1', passed: true, metrics: { validRate: 1 } });
  assert.equal(evaluation.deploymentId, 'deployment:provider-a/a');
  const comparison = manager.compare({ modelIds: ['acme/a', 'acme/b'], request: { requiredCapabilities: ['coding'] } });
  assert.equal(comparison.rows.length, 2);
  assert.equal(comparison.rows.every((row) => row.evaluation?.receiptSha256), true);
  const explanation = manager.explain({ candidateIds: ['acme/a', 'acme/b'], request: { requiredCapabilities: ['coding'] } });
  assert.equal(explanation.schema, 'nolane.model-routing-explanation.v1');
  assert.equal(explanation.candidates.length, 2);
  assert.match(explanation.receiptSha256, /^[a-f0-9]{64}$/);
});


test('management plane rehydrates health from durable runtime observations', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nolane-model-truth-replay-'));
  try {
    const profiles = [normalizeModelProfile({
      canonicalId: 'acme/replay', providerFamily: 'provider-replay', providerModelId: 'replay',
      identity: { publisher: 'acme', family: 'replay', displayName: 'Replay' }, lifecycle: { status: 'stable' },
      capabilities: { coding: true }, deployment: { remote: true }, provenance: { confidence: { overall: 0.9 } },
    })];
    const registry = new ModelProfileRegistry({ profiles, clock: () => '2026-08-04T00:00:00.000Z' });
    const file = path.join(directory, 'model-truth.json');
    const firstPlane = new ModelTruthPlane({ registry, store: new ModelTruthStore({ file, clock: () => '2026-08-04T00:00:00.000Z' }) });
    const first = new ModelManagementService({ registry, truthPlane: firstPlane, clock: () => '2026-08-04T00:00:00.000Z' });
    first.recordExecution('acme/replay', { success: false, latencyMs: 90, errorCode: 'provider_timeout', scope: { region: 'local' } });

    const reopenedPlane = new ModelTruthPlane({ registry, store: new ModelTruthStore({ file, clock: () => '2026-08-04T00:01:00.000Z' }) });
    const reopened = new ModelManagementService({ registry, truthPlane: reopenedPlane, clock: () => '2026-08-04T00:01:00.000Z' });
    const dossier = reopened.dossier('acme/replay');
    assert.equal(dossier.health.calls, 1);
    assert.equal(dossier.health.failures, 1);
    assert.equal(dossier.health.lastError, 'provider_timeout');
    assert.equal(dossier.truth.runtimeObservations.length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
