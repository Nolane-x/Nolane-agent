import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const fabric = await readFile(new URL('../src/repository/repository-intelligence-fabric.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
test('application composes knowledge graph, watcher, adaptive ranking, API, and shutdown through the lazy fabric', () => {
  assert.match(app, /createRepositoryIntelligenceFabric\(\{/);
  assert.match(fabric, /new CodebaseKnowledgeGraphService\(\{/);
  assert.match(fabric, /new CodebaseKnowledgeWatcher\(\{/);
  assert.match(fabric, /new AdaptiveRepositoryIntelligence\(\{ lexicalIndex, semanticIndex, mapService, graphService, scheduler \}\)/);
  assert.match(app, /createHttpServer\(\{[^}]*codebaseKnowledge/s);
  assert.match(app, /await repositoryIntelligenceFabric\.close\(\)/);
  assert.match(http, /codebaseKnowledge = null/);
  assert.match(routes, /\/api\/codebase-knowledge/);
});
