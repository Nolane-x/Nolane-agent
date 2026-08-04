import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application composes local code relationship intelligence through authenticated HTTP wiring', () => {
  assert.match(app, /import \{ CodeRelationshipIntelligenceService \}/);
  assert.match(app, /new CodeRelationshipIntelligenceService\(\{ store, codebaseKnowledge: codebaseKnowledgeGraph \}\)/);
  assert.match(app, /createHttpServer\(\{[^}]*codeRelationships/s);
  assert.match(http, /codeRelationships = null/);
  assert.match(http, /createRoutes\(\{[^}]*codeRelationships/s);
  assert.match(routes, /\/api\/code-relationships\/index/);
  assert.match(routes, /\/api\/code-relationships\/inheritance/);
  assert.match(routes, /\/api\/code-relationships\/issues/);
});
