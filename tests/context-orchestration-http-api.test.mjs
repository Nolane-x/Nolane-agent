import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer orchestration-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('Context Orchestration API is authenticated and binds checkpoint scope to the real principal', async (t) => {
  const calls = [];
  const contextOrchestration = {
    plan: (input) => { calls.push(['plan', input]); return { schema: 'forge.context-orchestration-plan.v1', ...input, receiptSha256: 'a'.repeat(64), items: input.items }; },
    checkpoint: (input) => { calls.push(['checkpoint', input]); return { id: 'ctxcp_1', ...input }; },
    getCheckpoint: (id, input) => { calls.push(['get', { id, ...input }]); return { id, ...input }; },
    pageCheckpoint: (id, input) => { calls.push(['page', { id, ...input }]); return { id, ...input, items: [] }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'orchestration-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, contextOrchestration, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/context-orchestration/plan`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${service.url}/api/context-orchestration/plan`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof', role: 'planner', items: [] }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/context-orchestration/checkpoints`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof', plan: { projectId: 'p1', principalId: 'local-admin', role: 'planner', receiptSha256: 'a'.repeat(64), items: [] } }) }))).status, 201);
  assert.equal((await fetch(`${service.url}/api/context-orchestration/checkpoints/ctxcp_1?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/context-orchestration/checkpoints/ctxcp_1/items?projectId=p1&limit=5`, auth())).status, 200);
  assert.deepEqual(calls.map(([name, input]) => [name, input.principalId]), [['plan', 'local-admin'], ['checkpoint', 'local-admin'], ['get', 'local-admin'], ['page', 'local-admin']]);
});
