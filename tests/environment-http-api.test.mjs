import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer env-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('environment HTTP API exposes authenticated read operations and capability-governed lifecycle actions', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-env-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const calls = [];
  const environmentControl = {
    list(input) { calls.push(['list', input]); return [{ id: 'web', projectId: 'p1', state: 'healthy' }]; },
    status(id, input) { calls.push(['status', id, input]); return { id, projectId: 'p1', state: 'healthy' }; },
    snapshot(id, input) { calls.push(['snapshot', id, input]); return { environmentId: id, manifestSha256: 'a'.repeat(64) }; },
    register(input, context) { calls.push(['register', input, context]); return { id: input.id, projectId: input.projectId, state: 'registered' }; },
    start(id, context) { calls.push(['start', id, context]); return { id, state: 'healthy', operationReceiptSha256: 'b'.repeat(64) }; },
    heal(id, context) { calls.push(['heal', id, context]); return { id, state: 'healthy', action: 'none' }; },
    recover(id, context) { calls.push(['recover', id, context]); return { id, state: 'healthy' }; },
    stop(id, context) { calls.push(['stop', id, context]); return { id, state: 'stopped' }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'env-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, environmentControl, uiRoot: root });
  t.after(() => service.close());

  assert.equal((await (await fetch(`${service.url}/api/environments?projectId=p1`, auth())).json())[0].id, 'web');
  assert.equal((await (await fetch(`${service.url}/api/environments/web`, auth())).json()).state, 'healthy');
  assert.match((await (await fetch(`${service.url}/api/environments/web/snapshot?projectId=p1`, auth())).json()).manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal((await (await fetch(`${service.url}/api/environments/register`, auth({ method: 'POST', body: JSON.stringify({ id: 'web', projectId: 'p1', cwd: root, command: process.execPath, args: ['server.mjs'], sessionId: 's1' }) }))).json()).state, 'registered');
  assert.equal((await (await fetch(`${service.url}/api/environments/web/start`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', sessionId: 's1' }) }))).json()).state, 'healthy');
  assert.equal((await (await fetch(`${service.url}/api/environments/web/heal`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', sessionId: 's1' }) }))).json()).action, 'none');
  assert.equal((await (await fetch(`${service.url}/api/environments/web/recover`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', sessionId: 's1' }) }))).json()).state, 'healthy');
  assert.equal((await (await fetch(`${service.url}/api/environments/web/stop`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', sessionId: 's1' }) }))).json()).state, 'stopped');
  assert.equal(calls.find((entry) => entry[0] === 'start')[2].principal.subject, 'local-admin');
});
