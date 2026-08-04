import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer knowledge-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });
test('codebase knowledge API is authenticated and binds project/principal inputs on the server', async (t) => {
  const calls = [];
  const codebaseKnowledge = {
    snapshot: (projectId, options) => { calls.push(['snapshot', projectId, options]); return { schema: 'forge.codebase-knowledge.v1', entities: [] }; },
    indexProject: async (input) => { calls.push(['index', input]); return { indexed: 1 }; },
    searchRegex: (projectId, pattern, options) => { calls.push(['regex', projectId, pattern, options]); return []; },
    rank: (projectId, query, options) => { calls.push(['rank', projectId, query, options]); return { items: [] }; },
    watchStart: async (input) => { calls.push(['watch-start', input]); return { state: 'watching' }; },
    watchStop: async (input) => { calls.push(['watch-stop', input]); return { state: 'stopped' }; },
    watchStatus: (projectId) => ({ projectId, state: 'watching' }),
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'knowledge-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, codebaseKnowledge, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge/index`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge/regex?projectId=p1&pattern=login`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge/rank?projectId=p1&q=login&seed=src%2Fapi.mjs`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge/watch/start`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/codebase-knowledge/watch/stop`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1' }) }))).status, 200);
  assert.ok(calls.some(([kind, input]) => kind === 'index' && input.principalId === 'local-admin' && input.projectId === 'p1'));
  assert.ok(calls.some(([kind, input]) => kind === 'watch-start' && input.principalId === 'local-admin'));
});
