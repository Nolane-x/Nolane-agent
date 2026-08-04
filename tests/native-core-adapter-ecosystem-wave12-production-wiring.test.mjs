import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave12-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const exported = [];
  const service = new NolaneNativeOrchestrationService({
    dataDir: path.join(root, '.data'),
    workspaceRoot: root,
    wave12ObservabilityExporter: { connected: () => true, export: async (batch) => exported.push(...batch) },
  });
  await service.open();
  return { service, exported };
}

function caller(service) {
  const route = createRoutes({ nativeOrchestration: service });
  return async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    await route(req, res, new URL(`http://local${pathname}`));
    return { status, body: data ? JSON.parse(data) : null };
  };
}

test('orchestration production-wires adapter ecosystem wave12', async (t) => {
  const { service, exported } = await fixture(t);
  const memory = await service.putNativeAdapterMemory({ id: 'm1', text: 'durable context', provenance: { sessionId: 's1' } });
  assert.equal(memory.version, 1);
  assert.equal(service.queryNativeAdapterMemory('context')[0].id, 'm1');
  const card = service.applyNativeAdapterKanban({ id: 'c1', title: 'Ship', column: 'todo', version: 1 });
  assert.equal(card.card.column, 'todo');
  service.recordNativeAdapterObservation({ type: 'span', token: 'secret' });
  assert.equal((await service.flushNativeAdapterObservations()).exported, 1);
  assert.equal(JSON.stringify(exported).includes('secret'), false);
  assert.equal(service.status().adapterWave12.memory.recordCount, 1);
});

test('HTTP adapter ecosystem wave12 routes expose status, memory, kanban and observability', async (t) => {
  const { service } = await fixture(t);
  const call = caller(service);
  const memory = await call({ method: 'POST', pathname: '/api/nolane/native-core/adapters/wave12/memory', body: { id: 'm1', text: 'hello memory' } });
  assert.equal(memory.status, 201);
  assert.equal(memory.body.version, 1);
  const query = await call({ pathname: '/api/nolane/native-core/adapters/wave12/memory?query=hello' });
  assert.equal(query.status, 200);
  assert.equal(query.body[0].id, 'm1');
  const kanban = await call({ method: 'POST', pathname: '/api/nolane/native-core/adapters/wave12/kanban', body: { id: 'c1', title: 'Card', column: 'todo', version: 1 } });
  assert.equal(kanban.status, 200);
  assert.equal(kanban.body.card.id, 'c1');
  const observation = await call({ method: 'POST', pathname: '/api/nolane/native-core/adapters/wave12/observability', body: { type: 'metric', password: 'hidden' } });
  assert.equal(observation.status, 202);
  const flush = await call({ method: 'POST', pathname: '/api/nolane/native-core/adapters/wave12/observability/flush' });
  assert.equal(flush.body.exported, 1);
  const status = await call({ pathname: '/api/nolane/native-core/adapters/wave12/status' });
  assert.equal(status.body.memory.recordCount, 1);
  assert.equal(status.body.kanban.cards, 1);
});
