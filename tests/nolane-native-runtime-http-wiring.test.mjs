import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('canonical Nolane runtime API exposes authenticated preflight and lifecycle controls', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-native-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const calls = [];
  const nativeRuntime = {
    preflight() { calls.push('preflight'); return { ready: true, protocol: 'nolane-agent-runtime/1' }; },
    status() { calls.push('status'); return { status: 'stopped', protocol: 'nolane-agent-runtime/1' }; },
    start() { calls.push('start'); return { status: 'running', protocol: 'nolane-agent-runtime/1' }; },
    ping() { calls.push('ping'); return { pong: true, protocol: 'nolane-agent-runtime/1' }; },
    stop() { calls.push('stop'); return { status: 'stopped', protocol: 'nolane-agent-runtime/1' }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, nativeRuntime, uiRoot: root });
  t.after(() => service.close());
  assert.equal((await fetch(`${service.url}/api/nolane/runtime/status`)).status, 401);
  assert.equal((await (await fetch(`${service.url}/api/nolane/runtime/preflight`, auth())).json()).ready, true);
  assert.equal((await (await fetch(`${service.url}/api/nolane/runtime/start`, auth({ method: 'POST', body: '{}' }))).json()).status, 'running');
  assert.equal((await (await fetch(`${service.url}/api/nolane/runtime/ping`, auth({ method: 'POST', body: '{}' }))).json()).pong, true);
  assert.equal((await (await fetch(`${service.url}/api/nolane/runtime/stop`, auth({ method: 'POST', body: '{}' }))).json()).status, 'stopped');
  assert.deepEqual(calls, ['preflight', 'start', 'ping', 'stop']);
});

test('application constructs and closes the canonical Nolane native runtime', async () => {
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /NolaneNativeRuntimeService/);
  assert.match(source, /const nativeRuntime = new NolaneNativeRuntimeService\(\{ projectRoot: appRoot/);
  assert.match(source, /nativeRuntime,/);
  assert.match(source, /await nativeRuntime\.stop\(\)/);
});
