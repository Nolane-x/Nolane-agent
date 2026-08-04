import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer tree-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('Tree-sitter API is authenticated, project-bound, and ignores principal/workspace spoofing', async (t) => {
  const calls = [];
  const treeSitterRuntime = {
    capabilities: async () => ({ schema: 'forge.tree-sitter-runtime-capabilities.v1', available: false, reason: 'not-installed' }),
    parse: async (input) => { calls.push(input); return { schema: 'forge.tree-sitter-parse.v1', projectId: input.projectId, file: input.file, receiptSha256: 'a'.repeat(64) }; },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'tree-token' },
    store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {},
    treeSitterRuntime, uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/tree-sitter/capabilities`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/tree-sitter/capabilities`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/tree-sitter/parse`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', file: 'src/app.ts', principalId: 'spoof', workspaceRoot: '/tmp/evil', command: 'rm' }) }))).status, 200);
  assert.deepEqual(calls, [{ projectId: 'p1', file: 'src/app.ts', principalId: 'local-admin' }]);
});
