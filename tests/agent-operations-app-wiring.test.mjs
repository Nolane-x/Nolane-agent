import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application composes and exposes the Agent Operations Center', () => {
  assert.match(app, /new AgentOperationsService\(\{/);
  assert.match(app, /toolCatalog: dynamicToolCatalog/);
  assert.match(app, /capabilityLedger: capabilityGrantLedger/);
  assert.match(app, /createHttpServer\(\{[^}]*operationsCenter/s);
  assert.match(http, /operationsCenter = null/);
  assert.match(http, /createRoutes\(\{[^}]*operationsCenter/s);
  assert.match(routes, /\/api\/operations-center/);
});
