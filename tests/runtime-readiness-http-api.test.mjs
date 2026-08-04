import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer readiness-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('runtime readiness API is authenticated, principal-bound, and project-root bounded', async (t) => {
  const calls = [];
  const architectureStageGate = { async inspect() { calls.push(['architecture']); return { status: 'pass' }; } };
  const missionCompletion = { async prepare(input) { calls.push(['prepare', input]); return { missionId: 'm1', receiptSha256: 'a'.repeat(64) }; } };
  const localContainerPreflight = { async check(input) { calls.push(['container', input]); return { status: 'pass', receiptSha256: 'b'.repeat(64) }; } };
  const store = {
    listEvents: () => [], listProjects: () => [],
    getProject(id) { return id === 'p1' ? { id: 'p1', workspaceRoot: path.resolve('/tmp/forge-p1') } : null; },
  };
  const server = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'readiness-token' },
    store, providers: new ProviderRegistry(), missionRunner: {}, architectureStageGate, missionCompletion, localContainerPreflight, uiRoot: path.resolve('ui'),
  });
  t.after(() => server.close());
  assert.equal((await fetch(`${server.url}/api/runtime-readiness/architecture`)).status, 401);
  assert.equal((await fetch(`${server.url}/api/runtime-readiness/architecture`, auth())).status, 200);
  assert.equal((await fetch(`${server.url}/api/runtime-readiness/missions`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', objective: 'finish', allowCommit: true, principalId: 'spoof', workspaceRoot: '/escape' }) }))).status, 201);
  assert.equal((await fetch(`${server.url}/api/runtime-readiness/container`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', workspaceRoot: '/escape', mounts: [{ source: 'src', target: '/workspace/src', readOnly: true }] }) }))).status, 200);
  assert.equal(calls[1][1].principalId, 'local-admin');
  assert.equal(Object.hasOwn(calls[1][1], 'workspaceRoot'), false);
  assert.equal(calls[2][1].projectRoot, path.resolve('/tmp/forge-p1'));
  assert.equal(calls[2][1].mounts[0].source, path.resolve('/tmp/forge-p1/src'));
});
