import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryIntelligenceFabric } from '../src/repository/repository-intelligence-fabric.mjs';

function runtimeFixture() {
  const calls = { activated: 0, semantic: 0, lexical: 0, providerClose: 0, runtimeClose: 0 };
  const runtimeFactory = () => {
    calls.activated += 1;
    return {
      repository: {
        async index(project) { return { schema: 'index', projectId: project.id }; },
        async search(projectId, query) {
          calls.semantic += 1;
          return { schema: 'forge.adaptive-repository-search.v1', query, indexState: { provenance: { branch: 'feature/fabric', headSha: 'a'.repeat(40), dirtyHash: 'clean' } }, items: [{ path: 'src/auth.mjs', startLine: 1, endLine: 3, contentSha256: 'b'.repeat(64), preview: 'validateSession', score: 1, sources: ['semantic'], scoreBreakdown: {} }] };
        },
        map(projectId) { return { schema: 'map', projectId }; },
        symbols(projectId) { return [{ projectId, name: 'validateSession' }]; },
        state(projectId) { return { projectId, semantic: { phase: 'ready' } }; },
        async completeEmbeddings(projectId) { return { projectId, completed: 1 }; },
        recordFeedback() {}, exportSnapshot() { return { schema: 'snapshot' }; }, reuseSnapshot() { return { schema: 'reuse' }; },
      },
      lexicalIndex: {
        search(projectId, query) {
          calls.lexical += 1;
          return [{ path: 'src/auth.mjs', language: 'javascript', lineCount: 3, sha256: 'b'.repeat(64), content: `export function ${query}(){}`, score: 20 }];
        },
      },
      semanticIndex: { embeddingProvider: { async close() { calls.providerClose += 1; } } },
      digitalTwin: { build(projectId) { return { schema: 'forge.repository-digital-twin.v2', projectId, nodes: [], edges: [], twinSha256: 'c'.repeat(64) }; } },
      graphService: { snapshot(projectId) { return { schema: 'graph', projectId }; }, async index(project) { return { projectId: project.id }; }, searchRegex() { return []; }, rank() { return { items: [] }; } },
      scheduler: { snapshot() { return { schema: 'scheduler', active: 0 }; }, close() {} },
      watcher: { async start(project) { return { projectId: project.id, state: 'watching' }; }, async stop(projectId) { return { projectId, state: 'stopped' }; }, status(projectId) { return { projectId, state: 'idle' }; } },
      async close() { calls.runtimeClose += 1; },
    };
  };
  return { calls, runtimeFactory };
}

test('RepositoryIntelligenceFabric activates lazily and exposes sanitized provider status', async () => {
  const { calls, runtimeFactory } = runtimeFixture();
  const registry = {
    async status() { return { schema: 'forge.embedding-provider-registry.v1', providers: [{ id: 'onnx-code', kind: 'neural', dimensions: 384, degraded: false, modelSha256: 'd'.repeat(64), available: true, internalPath: '/secret/model.onnx' }] }; },
    async close() {},
  };
  const fabric = new RepositoryIntelligenceFabric({ runtimeFactory, embeddingRegistry: registry, governor: { policy: () => ({ semanticIndexing: 'incremental' }), snapshot: () => ({ state: 'normal' }) } });
  const before = await fabric.status();
  assert.equal(calls.activated, 0);
  assert.equal(before.lifecycle, 'inactive');
  assert.deepEqual(Object.keys(before.embedding.providers[0]).sort(), ['available', 'degraded', 'dimensions', 'id', 'kind', 'modelSha256']);
  await fabric.search('p1', 'validateSession');
  assert.equal(calls.activated, 1);
  assert.equal((await fabric.status()).lifecycle, 'active');
});

test('RepositoryIntelligenceFabric keeps lexical evidence available while semantic work is suspended', async () => {
  const { calls, runtimeFactory } = runtimeFixture();
  const fabric = new RepositoryIntelligenceFabric({ runtimeFactory, embeddingRegistry: { async status() { return { schema: 'registry', providers: [] }; }, async close() {} }, governor: { policy: () => ({ semanticIndexing: 'suspended' }), snapshot: () => ({ state: 'emergency' }) } });
  const result = await fabric.search('p1', 'validateSession', { limit: 5 });
  assert.equal(calls.semantic, 0);
  assert.equal(calls.lexical, 1);
  assert.equal(result.semanticState, 'suspended');
  assert.equal(result.items[0].sources.includes('lexical'), true);
  await fabric.suspend('memory-pressure');
  assert.equal(calls.providerClose, 1);
  assert.equal((await fabric.status()).lifecycle, 'suspended');
  fabric.resume();
  assert.equal((await fabric.status()).lifecycle, 'active');
});

test('RepositoryIntelligenceFabric exposes digital twin, graph adapters, and closes once', async () => {
  const { calls, runtimeFactory } = runtimeFixture();
  const fabric = new RepositoryIntelligenceFabric({ runtimeFactory, embeddingRegistry: { async status() { return { schema: 'registry', providers: [] }; }, async close() {} } });
  assert.equal(fabric.digitalTwin('p1').schema, 'forge.repository-digital-twin.v2');
  assert.equal(fabric.graphSnapshot('p1').schema, 'graph');
  assert.equal(fabric.schedulerSnapshot().schema, 'scheduler');
  await fabric.close();
  await fabric.close();
  assert.equal(calls.runtimeClose, 1);
  await assert.rejects(() => fabric.search('p1', 'x'), /closed/i);
});
