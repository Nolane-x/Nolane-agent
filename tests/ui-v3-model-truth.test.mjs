import assert from 'node:assert/strict';
import test from 'node:test';

import { renderModelProfilesPanel } from '../ui-v3/views/settings/model-profiles-panel.mjs';
import { createSettingsController } from '../ui-v3/views/settings/settings-controller.mjs';

test('expert model UI shows truth freshness, conflicts, dossier, and deployment comparison', async () => {
  const model = { key: 'p/m', providerId: 'p', modelId: 'm', displayName: 'Model M', lifecycle: 'stable', capabilities: { text: true, tools: true, structuredOutput: true }, context: { inputTokens: 1000 }, metadata: { canonicalId: 'acme/m' }, truth: { canonicalId: 'acme/m', resolution: 'exact', facts: { fresh: 2, conflicted: 1 }, evaluations: 3 } };
  const dossier = { receiptSha256: 'a'.repeat(64), truth: { bundle: { baseModel: { id: 'base:acme/m' }, snapshot: { id: 'snapshot:acme/m' }, deployments: [{ id: 'deployment:p/m' }], localArtifacts: [] }, facts: { summary: { fresh: 2, conflicted: 1 } }, evaluations: [{}, {}, {}], runtimeObservations: [{}] }, uncertainty: { warnings: [] } };
  const comparison = { selected: ['acme/m', 'acme/n'], result: { receiptSha256: 'b'.repeat(64), rows: [{ modelId: 'acme/m', providerFamily: 'p', context: { contextWindow: 1000 }, toolCalling: { supported: true }, pricing: { inputPerMillion: 1 }, freshness: { fresh: 2 }, evaluation: { eligible: true } }, { modelId: 'acme/n', providerFamily: 'q', context: { contextWindow: 2000 }, toolCalling: { supported: null }, pricing: { inputPerMillion: null }, freshness: { conflicted: 1 }, evaluation: { eligible: false, blockers: [{}] } }] } };
  const html = renderModelProfilesPanel({ models: [model], providers: [{ id: 'p', label: 'Provider P' }] }, { experience: 'expert', comparison, dossiers: { 'acme/m': dossier } });
  assert.match(html, /1 conflicts/);
  assert.match(html, /3 evals/);
  assert.match(html, /base:acme\/m/);
  assert.match(html, /Compared model deployments/);
  assert.match(html, /Receipt b{64}/);
});

test('settings controller loads dossiers and compares selected canonical deployments', async () => {
  const calls = [];
  const api = {
    get: async (path) => {
      calls.push(['get', path]);
      if (path.includes('/api/settings/catalog')) return { categories: [] };
      if (path.includes('/api/settings/effective')) return { value: { experience: { level: 'expert' } } };
      if (path.includes('/api/model-profiles')) return { models: [] };
      if (path.includes('/api/provider-connections')) return [];
      if (path.includes('/api/model-management/dossier')) return { truth: { bundle: {} } };
      return {};
    },
    put: async () => ({}),
    post: async (path, body) => { calls.push(['post', path, body]); if (path === '/api/model-intelligence/compare') return { rows: [{ modelId: 'a' }, { modelId: 'b' }], receiptSha256: 'c'.repeat(64) }; return {}; },
  };
  const controller = createSettingsController({ api });
  await controller.load();
  controller.toggleModelComparison('a'); controller.toggleModelComparison('b');
  await controller.compareModels(); await controller.inspectModel('a');
  assert.equal(controller.snapshot().modelComparison.result.rows.length, 2);
  assert.ok(controller.snapshot().modelDossiers.a);
  assert.equal(calls.some((item) => item[1] === '/api/model-intelligence/compare'), true);
});
