import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer semdep-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('semantic dependency API is authenticated, bounded, and binds the real principal', async (t) => {
  const calls = [];
  const semanticDependency = {
    indexProject: async (input) => { calls.push(['index', input]); return { schema: 'forge.semantic-dependency-index.v1', receiptSha256: 'a'.repeat(64) }; },
    search: async (input) => { calls.push(['search', input]); return { schema: 'forge.semantic-dependency-search.v1', items: [], receiptSha256: 'b'.repeat(64) }; },
    dependencies: (input) => { calls.push(['graph', input]); return { schema: 'forge.semantic-dependency-graph.v1', nodes: [], edges: [], receiptSha256: 'c'.repeat(64) }; },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'semdep-token' },
    store: { listEvents: () => [], listProjects: () => [] },
    providers: new ProviderRegistry(),
    missionRunner: {},
    semanticDependency,
    uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/semantic-dependency/graph?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/semantic-dependency/index`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/semantic-dependency/search`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof', query: 'login', limit: 7, pathPrefix: 'src', language: 'javascript' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/semantic-dependency/graph?projectId=p1&rootPath=src%2Fapp.mjs&direction=incoming&depth=2&limit=30`, auth())).status, 200);

  assert.deepEqual(calls.map(([name, input]) => [name, input.principalId]), [['index', 'local-admin'], ['search', 'local-admin'], ['graph', 'local-admin']]);
  assert.deepEqual(calls[1][1], { projectId: 'p1', query: 'login', limit: 7, pathPrefix: 'src', language: 'javascript', principalId: 'local-admin' });
  assert.deepEqual(calls[2][1], { projectId: 'p1', rootPath: 'src/app.mjs', direction: 'incoming', depth: 2, limit: 30, principalId: 'local-admin' });
});
