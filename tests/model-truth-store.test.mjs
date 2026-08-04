import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ModelTruthStore } from '../src/model-profiles/model-truth-store.mjs';

test('field ledger is durable, credential-safe, and resolves source precedence', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-model-truth-'));
  const file = path.join(root, 'truth.json');
  const store = new ModelTruthStore({ file, clock: () => '2026-08-04T00:00:00.000Z', now: () => Date.parse('2026-08-04T01:00:00.000Z') });
  store.recordFact({ modelId: 'acme/m', path: 'context.maxOutputTokens', value: 8_000, sourceType: 'trusted-catalog-import', observedAt: '2026-08-04T00:00:00.000Z', scope: { provider: 'p' } });
  store.recordFact({ modelId: 'acme/m', path: 'context.maxOutputTokens', value: 16_000, sourceType: 'provider-api', observedAt: '2026-08-04T00:30:00.000Z', verifiedAt: '2026-08-04T00:30:00.000Z', scope: { provider: 'p' }, apiKey: 'must-not-persist' });
  const resolved = store.resolveFact('acme/m', 'context.maxOutputTokens');
  assert.equal(resolved.status, 'fresh');
  assert.equal(resolved.selected.value, 16_000);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.doesNotMatch(await readFile(file, 'utf8'), /must-not-persist/);
  const reopened = new ModelTruthStore({ file, now: () => Date.parse('2026-08-04T01:00:00.000Z') });
  assert.equal(reopened.resolveFact('acme/m', 'context.maxOutputTokens').selected.value, 16_000);
});

test('equal-strength contradictory facts remain visible as conflicts', () => {
  const store = new ModelTruthStore({ now: () => Date.parse('2026-08-04T01:00:00.000Z') });
  for (const value of [true, false]) store.recordFact({ modelId: 'acme/m', path: 'toolCalling.supported', value, sourceType: 'provider-api', sourceId: `source-${value}`, observedAt: '2026-08-04T00:00:00.000Z', scope: { provider: 'p' }, confidence: 0.95 });
  const resolved = store.resolveFact('acme/m', 'toolCalling.supported');
  assert.equal(resolved.status, 'conflicted');
  assert.equal(resolved.conflicts.length, 1);
});

test('discovery, evaluation, and runtime observations are bounded structured receipts', () => {
  const store = new ModelTruthStore({ clock: () => '2026-08-04T00:00:00.000Z' });
  const discovery = store.recordDiscovery({ providerFamily: 'p', models: [{ id: 'acme/m', apiKey: 'hidden' }] });
  const evaluation = store.recordEvaluation({ modelId: 'acme/m', suiteId: 'tools', suiteVersion: '1', passed: true, metrics: { valid: 10 } });
  const observation = store.recordRuntimeObservation('acme/m', { success: true, latencyMs: 25, metadata: { authorization: 'hidden' } });
  assert.match(discovery.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(evaluation.schema, 'nolane.model-evaluation.v1');
  assert.equal(observation.schema, 'nolane.model-observation.v1');
  assert.deepEqual(store.summary(), { ...store.summary() });
  assert.equal(store.summary().discoveries, 1);
});
