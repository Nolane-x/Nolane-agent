import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer relationships-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('code relationship API is authenticated and binds project queries to the real principal', async (t) => {
  const calls = [];
  const codeRelationships = {
    indexProject: async (input) => { calls.push(['index', input]); return { schema: 'forge.code-relationship-index.v1', receiptSha256: 'a'.repeat(64) }; },
    inheritance: (input) => { calls.push(['inheritance', input]); return { schema: 'forge.inheritance-graph.v1', nodes: [], edges: [], unresolved: [], receiptSha256: 'b'.repeat(64) }; },
    issues: (input) => { calls.push(['issues', input]); return { schema: 'forge.issue-code-index.v1', issues: [], links: [], receiptSha256: 'c'.repeat(64) }; },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'relationships-token' },
    store: { listEvents: () => [], listProjects: () => [] },
    providers: new ProviderRegistry(),
    missionRunner: {},
    codeRelationships,
    uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/code-relationships/inheritance?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/code-relationships/index`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', principalId: 'spoof', workspaceRoot: '/tmp/evil' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/code-relationships/inheritance?projectId=p1&root=FeatureService&path=src%2Ffeature.ts&direction=ancestors&depth=3&limit=40`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/code-relationships/issues?projectId=p1&issueKey=GH-42&pathPrefix=src%2F&limit=25`, auth())).status, 200);

  assert.deepEqual(calls[0], ['index', { projectId: 'p1', principalId: 'local-admin' }]);
  assert.deepEqual(calls[1], ['inheritance', { projectId: 'p1', root: 'FeatureService', path: 'src/feature.ts', direction: 'ancestors', depth: 3, limit: 40, principalId: 'local-admin' }]);
  assert.deepEqual(calls[2], ['issues', { projectId: 'p1', issueKey: 'GH-42', pathPrefix: 'src/', limit: 25, principalId: 'local-admin' }]);
});
