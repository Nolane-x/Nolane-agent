import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer context-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('Context and Memory Center API is authenticated and binds writes to the real principal', async (t) => {
  const calls = [];
  const contextMemoryCenter = {
    snapshot: async (input) => { calls.push(['snapshot', input]); return { schema: 'forge.context-memory-center.v1', projectId: input.projectId }; },
    pinArtifact: async (input) => { calls.push(['pin', input]); return { pinned: true, artifactId: input.artifactId }; },
    unpinArtifact: async (input) => { calls.push(['unpin', input]); return { unpinned: true, artifactId: input.artifactId }; },
    verifyMemory: async (input) => { calls.push(['verify', input]); return { fresh: true }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'context-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, contextMemoryCenter, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/context-memory-center?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/context-memory-center?projectId=p1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/context-memory-center/pins`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', artifactId: 'ctx_abc' }) }))).status, 201);
  assert.equal((await fetch(`${service.url}/api/context-memory-center/pins/ctx_abc?projectId=p1`, auth({ method: 'DELETE' }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/context-memory-center/memory/memory_1/verify`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1' }) }))).status, 200);
  assert.deepEqual(calls.map(([name, input]) => [name, input.principalId]), [['snapshot', 'local-admin'], ['pin', 'local-admin'], ['unpin', 'local-admin'], ['verify', 'local-admin']]);
});
