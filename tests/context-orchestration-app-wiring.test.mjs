import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
test('application composes and exposes Context Orchestration', () => {
  assert.match(app, /new ContextOrchestrationService\(\{/);
  assert.match(app, /file:\s*path\.join\(config\.dataDir, 'context-orchestration\.db'\)/);
  assert.match(app, /createHttpServer\(\{[^}]*contextOrchestration/s);
  assert.match(http, /contextOrchestration = null/);
  assert.match(routes, /\/api\/context-orchestration\/plan/);
  assert.match(routes, /\/api\/context-orchestration\/checkpoints/);
});
