import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { AdaptiveRepositoryIntelligence } from '../src/repository/adaptive-repository-intelligence.mjs';
import { CodebaseKnowledgeWatcher } from '../src/repository/codebase-knowledge-watcher.mjs';

const project = Object.freeze({ id: 'p1', workspaceRoot: '/tmp/p1' });

test('AdaptiveRepositoryIntelligence delegates indexing to the shared scheduler while preserving its public result schema', async () => {
  const requests = [];
  const scheduler = {
    enqueue: async (request) => {
      requests.push(request);
      return Object.freeze({ jobId: 'job-1', generation: request.generation, priority: request.priority, outputs: { lexical: { indexed: 1 }, semantic: { indexed: 2 }, graph: { indexed: 3 } }, skippedStages: [], receiptSha256: 'a'.repeat(64) });
    },
  };
  const lexicalIndex = { index: async () => ({ legacy: true }), search: () => [] };
  const semanticIndex = { index: async () => ({ legacy: true }), search: async () => ({ items: [] }), state: () => ({}) };
  const graphService = { index: async () => ({ legacy: true }), signature: async () => 'generation-7', rank: () => ({ items: [] }) };
  const intelligence = new AdaptiveRepositoryIntelligence({ lexicalIndex, semanticIndex, graphService, scheduler });
  const result = await intelligence.index(project, { priority: 'interactive', reason: 'user-opened-repository', deferEmbeddings: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].generation, 'generation-7');
  assert.equal(requests[0].priority, 'interactive');
  assert.equal(requests[0].deferEmbeddings, true);
  assert.deepEqual(requests[0].stages, ['lexical', 'semantic', 'graph']);
  assert.deepEqual(result, {
    schema: 'forge.adaptive-repository-index.v1',
    projectId: 'p1',
    lexical: { indexed: 1 },
    semantic: { indexed: 2 },
    graph: { indexed: 3 },
    scheduler: { jobId: 'job-1', generation: 'generation-7', priority: 'interactive', skippedStages: [], receiptSha256: 'a'.repeat(64) },
  });
});

test('CodebaseKnowledgeWatcher submits changed generations to the shared scheduler instead of starting an independent graph index', async () => {
  let signature = 'g1';
  let graphIndexes = 0;
  const requests = [];
  const events = [];
  const service = { signature: async () => signature, index: async () => { graphIndexes += 1; return { indexed: 1 }; } };
  const scheduler = { enqueue: async (request) => { requests.push(request); return { schema: 'forge.repository-intelligence-job-result.v1', projectId: request.project.id, generation: request.generation, outputs: { graph: { indexed: 1 } } }; } };
  const watcher = new CodebaseKnowledgeWatcher({ service, scheduler, intervalMs: 25, debounceMs: 0, onIndexed: (event) => events.push(event) });
  await watcher.start(project);
  signature = 'g2';
  const deadline = Date.now() + 1_000;
  while (!events.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  await watcher.stop(project.id);
  assert.equal(events.length, 1);
  assert.equal(graphIndexes, 0);
  assert.equal(requests[0].generation, 'g2');
  assert.equal(requests[0].priority, 'watcher');
  assert.deepEqual(requests[0].stages, ['lexical', 'semantic', 'graph']);
  watcher.close();
});

test('application composes one repository scheduler behind the lazy repository intelligence fabric', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const fabric = await readFile(new URL('../src/repository/repository-intelligence-fabric.mjs', import.meta.url), 'utf8');
  assert.match(app, /createRepositoryIntelligenceFabric\(\{/);
  assert.match(app, /repositoryIntelligenceFabric\.schedulerSnapshot\(\)/);
  assert.match(app, /await repositoryIntelligenceFabric\.close\(\)/);
  assert.match(fabric, /new RepositoryIntelligenceScheduler\(\{/);
  assert.match(fabric, /new CodebaseKnowledgeWatcher\(\{ service: graphService, scheduler \}\)/);
  assert.match(fabric, /new AdaptiveRepositoryIntelligence\(\{ lexicalIndex, semanticIndex, mapService, graphService, scheduler \}\)/);
  assert.match(fabric, /scheduler\.close\(\)/);
});
