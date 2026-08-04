import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave8-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: path.join(root, '.data'), workspaceRoot: root });
  await service.open();
  return service;
}

test('orchestration production-wires wave8 session runtime', async (t) => {
  const service = await fixture(t);
  await service.appendNativeSessionStream('s1', { id: 'm1', role: 'user', text: 'hello' });
  await service.appendNativeSessionStream('s1', { id: 'h1', role: 'system', text: 'private', visibility: 'hidden' });
  assert.deepEqual(service.resumeNativeSessionStream('s1').messages.map((entry) => entry.id), ['m1']);
  assert.equal(service.acquireNativeSessionWindow({ sessionId: 's1', windowId: 'w1', ttlMs: 100 }).owner, 'w1');
  const compressed = service.compressNativeSession({ sessionId: 's1', messages: service.resumeNativeSessionStream('s1').messages, maxCharacters: 20, keepRecent: 1 });
  assert.deepEqual(compressed.lineage, ['m1']);
  assert.equal(service.status().sessionWave8.sessions, 1);
});

test('HTTP session wave8 routes expose public state and lease conflicts', async (t) => {
  const service = await fixture(t);
  const route = createRoutes({ nativeOrchestration: service });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    try { await route(req, res, new URL(`http://local${pathname}`)); }
    catch (error) { status = error.statusCode ?? 500; data = JSON.stringify({ code: error.code, message: error.message }); }
    return { status, body: data ? JSON.parse(data) : null };
  };
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/sessions/stream/append', body: { sessionId: 's1', message: { id: 'm1', role: 'user', text: 'hello' } } })).status, 201);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/sessions/stream/append', body: { sessionId: 's1', message: { id: 'h1', role: 'system', text: 'private', visibility: 'hidden' } } })).status, 201);
  const resumed = await call({ pathname: '/api/nolane/native-core/sessions/stream/resume?sessionId=s1' });
  assert.deepEqual(resumed.body.messages.map((entry) => entry.id), ['m1']);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/sessions/window/acquire', body: { sessionId: 's1', windowId: 'w1', ttlMs: 1000 } })).status, 201);
  const conflict = await call({ method: 'POST', pathname: '/api/nolane/native-core/sessions/window/acquire', body: { sessionId: 's1', windowId: 'w2', ttlMs: 1000 } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'LEASE_CONFLICT');
  assert.equal((await call({ pathname: '/api/nolane/native-core/sessions/wave8/status' })).body.sessions, 1);
});
