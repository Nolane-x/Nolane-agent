import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer trace-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('Trace and Evidence Center API is authenticated and binds the real principal', async (t) => {
  const calls = [];
  const traceEvidenceCenter = {
    snapshot: async (input) => { calls.push(['snapshot', input]); return { schema: 'forge.trace-evidence-center.v1', projectId: input.projectId }; },
    events: async (input) => { calls.push(['events', input]); return { schema: 'forge.trace-event-page.v1', items: [] }; },
    exportBundle: async (input) => { calls.push(['export', input]); return { schema: 'forge.trace-evidence-export.v1', artifact: { id: 'ctx_a' } }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'trace-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, traceEvidenceCenter, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/trace-evidence?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/trace-evidence?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/trace-evidence/events?projectId=p1&after=4&limit=20`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/trace-evidence/export`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', missionId: 'm1', label: 'Bundle' }) }))).status, 201);
  assert.deepEqual(calls.map(([name, input]) => [name, input.principalId]), [['snapshot', 'local-admin'], ['events', 'local-admin'], ['export', 'local-admin']]);
});
