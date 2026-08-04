import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer operations-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('local operations API is authenticated, principal-bound, bounded, and serves verified image bytes', async (t) => {
  const calls = [];
  const localOperations = {
    async inspectImage(input) { calls.push(['inspect', input]); return { format: 'png', receiptSha256: 'a'.repeat(64) }; },
    async readImage(input) { calls.push(['read', input]); return { mimeType: 'image/png', buffer: Buffer.from('PNG'), contentSha256: 'b'.repeat(64), receiptSha256: 'c'.repeat(64) }; },
    async callGraph(input) { calls.push(['graph', input]); return { source: 'lsp' }; },
    async gitHistory(input) { calls.push(['history', input]); return { commits: [] }; },
    costSummary(input) { calls.push(['cost', input]); return { cost: { usedUsd: 0 } }; },
    editCommandCandidate(input) { calls.push(['edit', input]); return { approvalReusable: false }; },
    takeManualControl(input) { calls.push(['manual', input]); return { status: 'manual-control' }; },
    async retainSandbox(input) { calls.push(['retain', input]); return { state: 'retained' }; },
    async releaseSandbox(input) { calls.push(['release', input]); return { state: 'closed' }; },
    cacheStatus(input) { calls.push(['cache', input]); return { entries: [] }; },
    purgeCache(input) { calls.push(['purge', input]); return { deleted: 0 }; },
  };
  const server = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'operations-token' }, store: { listEvents: () => [], listProjects: () => [] },
    providers: new ProviderRegistry(), missionRunner: {}, localOperations, uiRoot: path.resolve('ui'),
  });
  t.after(() => server.close());
  assert.equal((await fetch(`${server.url}/api/local-operations/images/inspect?projectId=p1&path=a.png`)).status, 401);
  assert.equal((await fetch(`${server.url}/api/local-operations/images/inspect?projectId=p1&path=a.png`, auth())).status, 200);
  const binary = await fetch(`${server.url}/api/local-operations/images/content?projectId=p1&path=a.png`, auth());
  assert.equal(binary.status, 200); assert.equal(binary.headers.get('content-type'), 'image/png'); assert.equal(await binary.text(), 'PNG');
  assert.equal((await fetch(`${server.url}/api/local-operations/call-graph`, auth({ method: 'POST', body: JSON.stringify({ projectId:'p1', principalId:'spoof', languageId:'typescript', path:'src/a.ts', line:0, character:1, workspaceRoot:'/escape' }) }))).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/git-history?projectId=p1&limit=10`, auth())).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/cost?projectId=p1&missionId=m1`, auth())).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/command-candidates`, auth({ method:'POST', body:JSON.stringify({ projectId:'p1', taskId:'t1', command:'npm', args:['test'], principalId:'spoof' }) }))).status, 201);
  assert.equal((await fetch(`${server.url}/api/local-operations/manual-control`, auth({ method:'POST', body:JSON.stringify({ projectId:'p1', missionId:'m1', reason:'take over' }) }))).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/sandboxes/l1/retain`, auth({ method:'POST', body:JSON.stringify({ projectId:'p1', retainForMs:1000 }) }))).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/sandboxes/l1/release`, auth({ method:'POST', body:JSON.stringify({ projectId:'p1', terminate:true }) }))).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/cache?projectId=p1&namespace=operations`, auth())).status, 200);
  assert.equal((await fetch(`${server.url}/api/local-operations/cache?projectId=p1&namespace=operations`, auth({ method:'DELETE' }))).status, 200);
  assert.equal(calls[0][1].principalId, 'local-admin');
  assert.equal(calls[2][1].principalId, 'local-admin');
  assert.equal(Object.hasOwn(calls[2][1], 'workspaceRoot'), false);
});
