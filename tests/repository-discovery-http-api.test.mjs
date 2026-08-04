import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer discovery-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });
test('repository discovery API is authenticated and binds the real principal', async (t) => {
  const calls = [];
  const repositoryDiscovery = { snapshot: async (input) => { calls.push(input); return { schema: 'forge.repository-discovery.v1', projectId: input.projectId, refresh: input.refresh }; } };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'discovery-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, repositoryDiscovery, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/repository-discovery?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/repository-discovery?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/repository-discovery/refresh`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1' }) }))).status, 200);
  assert.deepEqual(calls, [
    { projectId: 'p1', principalId: 'local-admin', refresh: false },
    { projectId: 'p1', principalId: 'local-admin', refresh: true },
  ]);
});
