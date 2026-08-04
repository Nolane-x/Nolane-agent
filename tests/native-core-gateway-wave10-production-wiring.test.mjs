import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave10-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: path.join(root, '.data'), workspaceRoot: root });
  await service.open();
  service.registerNativeMessagingAdapter({ id: 'discord', platform: 'discord', adapter: {
    manifest: { platform: 'discord', permissions: ['message:receive','message:send'], maxAttachmentBytes: 1024 },
    async start() {}, async stop() {}, async probe() { return { ready: true }; },
    normalizeInbound(raw) { return { eventId: raw.id, principalId: raw.user, channel: raw.channel, text: raw.text }; },
    async send(message) { return { externalId: `discord-${message.eventId}` }; },
  } });
  await service.startNativeMessagingAdapter('discord');
  return service;
}

test('orchestration production-wires gateway wave10 runtime', async (t) => {
  const service = await fixture(t);
  const inbound = service.normalizeNativeMessagingInbound('discord', { id: 'i1', user: 'u1', channel: 'c1', text: 'hello' });
  assert.equal(inbound.platform, 'discord');
  const delivery = await service.deliverNativeMessaging('discord', { eventId: 'o1', channel: 'c1', text: 'world' });
  assert.equal(delivery.externalId, 'discord-o1');
  assert.equal(service.status().gatewayWave10.adapters.length, 1);
});

test('HTTP gateway wave10 routes expose status, inbound and outbound operations', async (t) => {
  const service = await fixture(t);
  const route = createRoutes({ nativeOrchestration: service });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    await route(req, res, new URL(`http://local${pathname}`));
    return { status, body: data ? JSON.parse(data) : null };
  };
  const inbound = await call({ method: 'POST', pathname: '/api/nolane/native-core/gateway/wave10/inbound', body: { adapterId: 'discord', raw: { id: 'i1', user: 'u1', channel: 'c1', text: 'hello' } } });
  assert.equal(inbound.status, 200);
  assert.equal(inbound.body.principalId, 'u1');
  const delivery = await call({ method: 'POST', pathname: '/api/nolane/native-core/gateway/wave10/deliver', body: { adapterId: 'discord', message: { eventId: 'o1', channel: 'c1', text: 'world' } } });
  assert.equal(delivery.status, 200);
  assert.equal(delivery.body.externalId, 'discord-o1');
  assert.equal((await call({ pathname: '/api/nolane/native-core/gateway/wave10/status' })).body.adapters.length, 1);
});
