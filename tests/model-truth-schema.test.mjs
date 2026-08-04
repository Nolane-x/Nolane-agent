import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeModelProfile } from '../src/model-profiles/model-profile-schema.mjs';
import { legacyProfileToTruthBundle, truthBundleToLegacyProfile, validateTruthBundle } from '../src/model-profiles/model-truth-schema.mjs';

function profile() {
  return normalizeModelProfile({
    canonicalId: 'acme/code-7b', aliases: ['code-7b'], providerFamily: 'ollama', providerModelId: 'code-7b:q4',
    identity: { publisher: 'acme', family: 'code', version: '1.2', license: null, openWeights: true },
    architecture: { type: 'dense', totalParameters: 7_000_000_000, tokenizerId: null, format: 'gguf', quantization: 'q4_k_m', runtime: 'ollama' },
    context: { contextWindow: 32_000, maxOutputTokens: null },
    capabilities: { coding: true, structuredOutput: null }, toolCalling: { supported: null },
    deployment: { local: true, remote: false, selfHostable: true },
    localRequirements: { estimatedRamGB: 6.5 },
    extensions: { futureUnknown: { preserved: true } },
  });
}

test('legacy profiles migrate into four canonical entity types without schema collision', () => {
  const source = profile();
  const bundle = legacyProfileToTruthBundle(source, { generatedAt: '2026-08-04T00:00:00.000Z' });
  assert.equal(validateTruthBundle(bundle), true);
  assert.equal(bundle.schema, 'nolane.model-truth-bundle.v1');
  assert.equal(bundle.baseModel.schema, 'nolane.model-base.v1');
  assert.equal(bundle.snapshot.schema, 'nolane.model-snapshot.v1');
  assert.equal(bundle.deployments[0].schema, 'nolane.model-deployment.v1');
  assert.equal(bundle.localArtifacts[0].schema, 'nolane.local-model-artifact.v1');
  assert.notEqual(bundle.schema, 'nolane.model-profiles.v2');
});

test('migration round-trip preserves unknown, null, false, and zero semantics', () => {
  const source = profile();
  const roundTrip = truthBundleToLegacyProfile(legacyProfileToTruthBundle(source));
  assert.deepEqual(roundTrip, source);
  assert.equal(roundTrip.context.maxOutputTokens, null);
  assert.equal(roundTrip.deployment.remote, false);
  assert.equal(roundTrip.provenance.confidence.pricing, 0);
  assert.equal(roundTrip.extensions.futureUnknown.preserved, true);
});
