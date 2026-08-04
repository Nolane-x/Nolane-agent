import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer sandbox-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('local resource sandbox API is authenticated, principal-bound, and exposes no arbitrary PID attach endpoint', async (t) => {
  const calls = [];
  const localResourceSandbox = {
    async capabilities() { calls.push(['capabilities']); return { schema: 'forge.local-resource-sandbox-capabilities.v1' }; },
    list(input) { calls.push(['list', input]); return []; },
    status(id, input) { calls.push(['status', id, input]); return { id, state: 'active' }; },
    async sample(id, input) { calls.push(['sample', id, input]); return { id, state: 'pressure' }; },
    async closeLease(id, input) { calls.push(['close', id, input]); return { id, state: 'closed' }; },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'sandbox-token' },
    store: { listEvents: () => [], listProjects: () => [] },
    providers: new ProviderRegistry(), missionRunner: {}, localResourceSandbox,
    uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes/capabilities`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes/capabilities`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes/lease-1?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes/lease-1/sample`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes/lease-1/close`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof', terminate: false }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/local-resource-sandboxes/attach`, auth({ method: 'POST', body: JSON.stringify({ pid: 1 }) }))).status, 404);

  assert.deepEqual(calls, [
    ['capabilities'],
    ['list', { projectId: 'p1', principalId: 'local-admin' }],
    ['status', 'lease-1', { projectId: 'p1', principalId: 'local-admin' }],
    ['sample', 'lease-1', { projectId: 'p1', principalId: 'local-admin' }],
    ['close', 'lease-1', { projectId: 'p1', principalId: 'local-admin', terminate: false }],
  ]);
});
