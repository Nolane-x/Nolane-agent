import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer policy-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });
test('instruction policy API is authenticated and binds principal and query scope', async (t) => {
  const calls = [];
  const instructionPolicy = { resolve: async (input) => { calls.push(input); return { schema: 'forge.instruction-policy.v1', projectId: input.projectId }; } };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'policy-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, instructionPolicy, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/instruction-policy?projectId=p1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/instruction-policy?projectId=p1&path=src/app.ts&language=typescript&taskType=refactor`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/instruction-policy/refresh`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', paths: ['src/app.ts'], language: 'typescript', taskType: 'refactor' }) }))).status, 200);
  assert.deepEqual(calls, [
    { projectId: 'p1', principalId: 'local-admin', paths: ['src/app.ts'], language: 'typescript', taskType: 'refactor', refresh: false },
    { projectId: 'p1', principalId: 'local-admin', paths: ['src/app.ts'], language: 'typescript', taskType: 'refactor', refresh: true },
  ]);
});
