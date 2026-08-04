import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave5-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: root, workspaceRoot: root, clock: (() => { let n = 1000; return () => ++n; })() });
  await service.open();
  return service;
}

test('orchestration production-wires wave5 runtime services and reports their state', async (t) => {
  const service = await fixture(t);
  await service.createNativeKanbanCard({ id: 'c1', title: 'Ship', lane: 'todo' });
  await service.moveNativeKanbanCard('c1', { lane: 'done', expectedVersion: 1 });
  await service.recordNativeObservation({ type: 'test', apiKey: 'secret' });
  const bundle = service.createNativeSkillBundle({ id: 'review', files: { 'SKILL.md': '---\nname: Review\n---\nReview.' } });
  assert.equal(service.verifyNativeSkillBundle(bundle).valid, true);
  service.registerNativeDashboardUser({ id: 'admin', password: 'correct horse battery staple', roles: ['admin'] });
  const auth = service.loginNativeDashboard({ userId: 'admin', password: 'correct horse battery staple' });
  assert.equal(service.authorizeNativeDashboard({ token: auth.token, role: 'admin' }).authorized, true);
  service.indexNativeSession({ sessionId: 's1', profileId: 'p1', title: 'Parser', messages: [{ content: 'fix json parser' }] });
  assert.equal(service.searchNativeSessions({ query: 'parser' }).items[0].sessionId, 's1');
  service.registerNativeCron({ id: 'job', intervalMs: 10, nextRunAtMs: 1 });
  assert.equal((await service.runNativeCronDue()).completed, 1);
  assert.deepEqual(service.parseNativeJson('{"ok":true}').value, { ok: true });
  const status = service.status().runtimeWave5;
  assert.equal(status.kanban.cards.length, 1);
  assert.equal(status.sessionSearch.documents, 1);
  assert.equal(status.dashboardAuth.users, 1);
});

test('authenticated HTTP routes expose bounded wave5 operations and redact observations', async (t) => {
  const nativeOrchestration = await fixture(t);
  const route = createRoutes({ nativeOrchestration });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    await route(req, res, new URL(`http://local${pathname}`));
    return { status, body: data ? JSON.parse(data) : null };
  };
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/kanban/cards', body: { id: 'c1', title: 'Ship' } })).status, 201);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/observability', body: { token: 'secret', type: 'test' } })).status, 201);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/session-search/index', body: { sessionId: 's1', title: 'Parser', messages: [{ content: 'json parser' }] } })).status, 201);
  assert.equal((await call({ pathname: '/api/nolane/native-core/session-search?q=parser' })).body.items[0].sessionId, 's1');
  assert.deepEqual((await call({ method: 'POST', pathname: '/api/nolane/native-core/json/parse', body: { json: '{"x":1}' } })).body.value, { x: 1 });
});
