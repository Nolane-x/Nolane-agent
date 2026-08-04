import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave9-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: path.join(root, '.data'), workspaceRoot: root });
  await service.open();
  service.registerNativeProviderTransport({ id: 'sim', protocol: 'codex-app-server', transport: async ({ emit }) => { emit({ type: 'text-delta', delta: 'wired' }); emit({ type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }); } });
  return service;
}

test('orchestration production-wires provider transport wave9', async (t) => {
  const service = await fixture(t);
  const result = await service.completeNativeProviderTransport({ providerId: 'sim', messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(result.text, 'wired');
  assert.equal(service.status().providerWave9.providers.length, 1);
});

test('HTTP provider wave9 routes expose completion and secret-free status', async (t) => {
  const service = await fixture(t);
  const route = createRoutes({ nativeOrchestration: service });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    await route(req, res, new URL(`http://local${pathname}`));
    return { status, body: data ? JSON.parse(data) : null };
  };
  const completed = await call({ method: 'POST', pathname: '/api/nolane/native-core/provider/wave9/complete', body: { providerId: 'sim', messages: [{ role: 'user', content: 'hello' }] } });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.text, 'wired');
  const status = await call({ pathname: '/api/nolane/native-core/provider/wave9/status' });
  assert.equal(status.status, 200);
  assert.equal(status.body.providers[0].id, 'sim');
  assert.equal(JSON.stringify(status.body).includes('credentialRef'), false);
});
