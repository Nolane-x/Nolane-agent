import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

function auth(token = 'ops-token', init = {}) { return { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } }; }

test('authenticated operations-center API forwards project and real principal', async (t) => {
  const calls = [];
  const operationsCenter = { snapshot: async (input) => { calls.push(input); return { schema: 'forge.agent-operations-center.v1', projectId: input.projectId, principalId: input.principalId }; } };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'ops-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, operationsCenter, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  const unauthorized = await fetch(`${service.url}/api/operations-center?projectId=p1`);
  assert.equal(unauthorized.status, 401);
  const response = await fetch(`${service.url}/api/operations-center?projectId=p1`, auth());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).projectId, 'p1');
  assert.deepEqual(calls, [{ projectId: 'p1', principalId: 'local-admin' }]);
});
