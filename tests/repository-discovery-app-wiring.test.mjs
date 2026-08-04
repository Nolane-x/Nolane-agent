import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
test('application composes and exposes repository discovery', () => {
  assert.match(app, /new RepositoryDiscoveryService\(\{/);
  assert.match(app, /createHttpServer\(\{[^}]*repositoryDiscovery/s);
  assert.match(http, /repositoryDiscovery = null/);
  assert.match(routes, /\/api\/repository-discovery/);
});
