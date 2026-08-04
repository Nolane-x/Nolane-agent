import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { GatewayApiSurface } from '../src/native-core/gateway-api-surface.mjs';
import { NolaneGatewayRegistry } from '../src/nolane-native/gateway-registry.mjs';
import { MediaProviderRegistry } from '../src/nolane-native/media-provider-registry.mjs';
import { AudioProviderRegistry } from '../src/nolane-native/audio-provider-registry.mjs';
import { createRoutes } from '../src/server/routes.mjs';

const hex64 = /^[a-f0-9]{64}$/;
const clock = (() => { let n = 100; return () => ++n; })();

function setup() {
  const gateways = new NolaneGatewayRegistry();
  let running = false;
  gateways.register({ id: 'local', platform: 'local', capabilities: ['message:send'], probe: async () => ({ ready: true }), start: async () => { running = true; }, stop: async () => { running = false; }, status: () => running });
  const delivered = [];
  const surface = new GatewayApiSurface({ gateways, clock, deliveryHandler: async (message) => { delivered.push(message); return { externalId: `x-${delivered.length}`, delivered: true }; }, runtimeSnapshot: () => ({ runtime: 'shared', sessions: 2 }) });
  return { gateways, surface, delivered };
}

test('gateway API requires pairing before authorized events and binds principal to gateway', async () => {
  const { gateways, surface } = setup();
  await gateways.start('local');
  const pairing = surface.issuePairing({ gatewayId: 'local', expiresInMs: 1000 });
  assert.match(pairing.code, /^[A-Z0-9]{8}$/);
  const accepted = surface.acceptPairing({ code: pairing.code, principalId: 'user:1' });
  assert.equal(accepted.gatewayId, 'local');
  assert.equal(surface.authorization('local', 'user:1').authorized, true);
  assert.throws(() => surface.enqueueEvent({ gatewayId: 'local', principalId: 'user:2', sessionId: 's', type: 'message', text: 'no' }), /not paired|unauthorized/i);
});

test('gateway event ledger is ordered, idempotent and validates attachment hashes and byte limits', async () => {
  const { gateways, surface } = setup(); await gateways.start('local');
  const pair = surface.issuePairing({ gatewayId: 'local' }); surface.acceptPairing({ code: pair.code, principalId: 'user:1' });
  const bytes = Buffer.from('file');
  const first = surface.enqueueEvent({ gatewayId: 'local', principalId: 'user:1', sessionId: 's1', type: 'message', text: 'hello', idempotencyKey: 'same', attachments: [{ name: 'a.txt', mimeType: 'text/plain', bytes }] });
  const duplicate = surface.enqueueEvent({ gatewayId: 'local', principalId: 'user:1', sessionId: 's1', type: 'message', text: 'changed', idempotencyKey: 'same' });
  assert.equal(duplicate.eventId, first.eventId);
  assert.equal(first.sequence, 1);
  assert.equal(first.attachments[0].bytes, 4);
  assert.match(first.attachments[0].sha256, hex64);
  assert.equal(surface.stream({ afterSequence: 0 })[0].receiptSha256, first.receiptSha256);
  assert.throws(() => surface.enqueueEvent({ gatewayId: 'local', principalId: 'user:1', sessionId: 's1', type: 'message', text: 'bad', attachments: [{ name: 'bad', mimeType: 'x', bytes, sha256: '0'.repeat(64) }] }), /attachment hash/i);
});

test('delivery queue acknowledges once and shared snapshot drives all product surfaces', async () => {
  const { gateways, surface, delivered } = setup(); await gateways.start('local');
  const pair = surface.issuePairing({ gatewayId: 'local' }); surface.acceptPairing({ code: pair.code, principalId: 'user:1' });
  const event = surface.enqueueEvent({ gatewayId: 'local', principalId: 'user:1', sessionId: 's1', type: 'message', text: 'hello', idempotencyKey: 'd1' });
  const receipt = await surface.deliver(event.eventId);
  assert.equal(receipt.status, 'delivered');
  assert.equal(delivered.length, 1);
  const second = await surface.deliver(event.eventId);
  assert.equal(second.receiptSha256, receipt.receiptSha256);
  const snapshot = surface.snapshot();
  assert.equal(snapshot.runtime.runtime, 'shared');
  assert.equal(snapshot.events, 1);
  assert.equal(snapshot.delivered, 1);
  assert.match(snapshot.headSha256, hex64);
});

test('media and audio dispatch keep credential references out of API receipts', async () => {
  const { surface } = setup();
  const media = new MediaProviderRegistry();
  media.register({ id: 'image', capabilities: ['image.generate'], credentialRef: 'secret:media', execute: async () => ({ bytes: Buffer.from('png'), mimeType: 'image/png' }) });
  const audio = new AudioProviderRegistry();
  audio.register({ id: 'speech', capabilities: ['audio.transcribe'], credentialRef: 'secret:audio', execute: async () => ({ text: 'hello', language: 'en' }) });
  surface.attachMedia({ media, audio });
  const image = await surface.executeMedia({ kind: 'media', capability: 'image.generate' });
  const speech = await surface.executeMedia({ kind: 'audio', capability: 'audio.transcribe' });
  assert.equal(image.artifactBytes, 3);
  assert.equal(speech.text, 'hello');
  assert.equal(JSON.stringify({ image, speech }).includes('secret:'), false);
});

test('HTTP routes expose bounded native-core status, pairing, events and delivery', async () => {
  const { gateways, surface } = setup(); await gateways.start('local');
  const nativeOrchestration = { nativeCoreStatus: () => surface.snapshot(), issueGatewayPairing: (body) => surface.issuePairing(body), acceptGatewayPairing: (body) => surface.acceptPairing(body), enqueueGatewayEvent: (body) => surface.enqueueEvent(body), deliverGatewayEvent: (id) => surface.deliver(id), streamGatewayEvents: (options) => surface.stream(options) };
  const route = createRoutes({ nativeOrchestration });
  const call = async ({ method, pathname, body = null, subject = 'user:1', search = '' }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    const handled = await route(req, res, new URL(`http://local${pathname}${search}`));
    return { handled, status, body: data ? JSON.parse(data) : null };
  };
  const pairing = await call({ method: 'POST', pathname: '/api/nolane/native-core/pairing', body: { gatewayId: 'local' } });
  assert.equal(pairing.status, 201);
  await call({ method: 'POST', pathname: '/api/nolane/native-core/pairing/accept', body: { code: pairing.body.code } });
  const event = await call({ method: 'POST', pathname: '/api/nolane/native-core/events', body: { gatewayId: 'local', sessionId: 's1', type: 'message', text: 'hello', idempotencyKey: 'http:1' } });
  assert.equal(event.status, 201);
  const delivered = await call({ method: 'POST', pathname: `/api/nolane/native-core/events/${event.body.eventId}/deliver`, body: {} });
  assert.equal(delivered.body.status, 'delivered');
  const status = await call({ method: 'GET', pathname: '/api/nolane/native-core/status' });
  assert.equal(status.body.events, 1);
});

test('Electron preload exposes native core status through a sender-validated IPC channel', async () => {
  const main = await readFile('desktop/main.cjs', 'utf8');
  const preload = await readFile('desktop/preload.cjs', 'utf8');
  assert.match(main, /nolane:core-status/);
  assert.match(main, /safeSender\(event\)/);
  assert.match(main, /api\/nolane\/native-core\/status/);
  assert.match(preload, /getNativeCoreStatus/);
  assert.match(preload, /nolane:core-status/);
});
