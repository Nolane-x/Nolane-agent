import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('canonical Nolane agent run API is authenticated and delegates to native service', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-agent-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const nativeAgent = { async run(input) { calls.push(input); return { status: 'completed', receipt: { sha256: 'a'.repeat(64) } }; } };
  const server = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, nativeAgent, uiRoot: root });
  t.after(() => server.close());
  assert.equal((await fetch(`${server.url}/api/nolane/agent/runs`, { method: 'POST', body: '{}' })).status, 401);
  const response = await fetch(`${server.url}/api/nolane/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ missionId: 'm1', sessionId: 's1', projectId: 'p1', objective: 'Build' }) }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, 'completed');
  assert.equal(calls[0].projectId, 'p1');
});

test('application constructs the production Nolane native agent service', async () => {
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /NolaneNativeAgentService/);
  assert.match(source, /const nativeAgent = new NolaneNativeAgentService\(/);
  assert.match(source, /providerSource: providers/);
  assert.match(source, /nativeAgent,/);
});
