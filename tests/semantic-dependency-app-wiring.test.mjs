import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application composes and exposes SemanticDependencyIntelligenceService', () => {
  assert.match(app, /SemanticDependencyIntelligenceService/);
  assert.match(app, /const semanticDependency = new SemanticDependencyIntelligenceService\(\{\s*store,\s*repositoryIntelligence,\s*codebaseKnowledge:\s*codebaseKnowledgeGraph\s*\}\)/s);
  assert.match(app, /createHttpServer\(\{[^}]*semanticDependency/s);
  assert.match(http, /semanticDependency = null/);
  assert.match(http, /createRoutes\(\{[^}]*semanticDependency/s);
  assert.match(routes, /\/api\/semantic-dependency\/search/);
  assert.match(routes, /semanticDependency\.dependencies/);
});
