import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GatewayMessagingRuntimeWave10,
  GatewayAdapterTckWave10,
  GatewayCommandManifest,
  GatewayPairingEnrollment,
  GatewayRelayNormalizer,
  GatewayRemoteLifecycle,
  GatewayHostSupervisor,
  GatewayTuiProjection,
} from '../src/native-core/gateway-messaging-runtime-wave10.mjs';

const platforms = ['telegram','discord','slack','whatsapp','matrix','teams','feishu','webhook'];
const fakeAdapter = (platform) => ({
  manifest: { platform, permissions: ['message:receive','message:send','attachment:read'], maxAttachmentBytes: 16 },
  async start() {}, async stop() {}, async probe() { return { ready: true }; },
  normalizeInbound(raw) { return { eventId: raw.id, principalId: raw.user, channel: raw.channel, text: raw.text, attachments: raw.attachments ?? [] }; },
  async send(message) { return { externalId: `${platform}-${message.eventId}` }; },
});

test('gateway adapter TCK validates all supported platform contracts', async () => {
  for (const platform of platforms) {
    const report = await new GatewayAdapterTckWave10().verify({ id: platform, adapter: fakeAdapter(platform) });
    assert.equal(report.status, 'pass', platform);
    assert.equal(report.checks.permission, true);
    assert.equal(report.checks.lifecycle, true);
    assert.equal(report.checks.duplicateDelivery, true);
    assert.equal(report.checks.redaction, true);
  }
});

test('runtime normalizes inbound events, bounds attachment hashes and deduplicates outbound delivery', async () => {
  const runtime = new GatewayMessagingRuntimeWave10();
  runtime.register({ id: 'discord', platform: 'discord', adapter: fakeAdapter('discord') });
  await runtime.start('discord');
  const inbound = runtime.normalizeInbound('discord', { id: 'e1', user: 'u1', channel: 'c1', text: 'hello', attachments: [{ name: 'a.txt', bytes: Buffer.from('abc') }] });
  assert.equal(inbound.attachments[0].bytes, 3);
  assert.match(inbound.attachments[0].sha256, /^[a-f0-9]{64}$/);
  const first = await runtime.deliver('discord', { eventId: 'e2', channel: 'c1', text: 'world' });
  const second = await runtime.deliver('discord', { eventId: 'e2', channel: 'c1', text: 'world' });
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(JSON.stringify(runtime.snapshot()).includes('credential'), false);
});

test('command manifest, pairing and relay normalization fail closed', () => {
  const commands = new GatewayCommandManifest();
  commands.register({ id: 'status', permission: 'runtime:read', handler: async () => ({ ok: true }) });
  assert.throws(() => commands.register({ id: 'status', permission: 'runtime:read', handler: async () => ({}) }), /already registered/);
  assert.throws(() => commands.authorize({ commandId: 'status', permissions: [] }), (error) => error.code === 'PERMISSION_DENIED');
  assert.equal(commands.authorize({ commandId: 'status', permissions: ['runtime:read'] }).allowed, true);

  let now = 100;
  const pairing = new GatewayPairingEnrollment({ clock: () => now });
  const issued = pairing.issue({ platform: 'discord', principalId: 'u1', ttlMs: 10 });
  assert.equal(pairing.accept({ code: issued.code, platform: 'discord', principalId: 'u1' }).enrolled, true);
  assert.throws(() => pairing.accept({ code: issued.code, platform: 'discord', principalId: 'u1' }), (error) => error.code === 'PAIRING_REPLAY');
  const expired = pairing.issue({ platform: 'slack', principalId: 'u2', ttlMs: 10 }); now = 111;
  assert.throws(() => pairing.accept({ code: expired.code, platform: 'slack', principalId: 'u2' }), (error) => error.code === 'PAIRING_EXPIRED');

  const relay = new GatewayRelayNormalizer({ maxAttachmentBytes: 4 });
  assert.throws(() => relay.normalize({ eventId: 'e', principalId: 'u', channel: 'c', text: 'x', attachments: [{ name: 'x', bytes: Buffer.alloc(5) }] }), (error) => error.code === 'ATTACHMENT_TOO_LARGE');
});

test('remote lifecycle reconnects, host supervisor drains and TUI projection exposes public state only', async () => {
  let connects = 0;
  const lifecycle = new GatewayRemoteLifecycle({ connect: async () => { connects += 1; if (connects === 1) throw Object.assign(new Error('down'), { retryable: true }); return { sessionId: 'r1' }; }, disconnect: async () => {} });
  assert.equal((await lifecycle.start({ maxAttempts: 2 })).state, 'running');
  assert.equal(connects, 2);
  assert.equal((await lifecycle.stop()).state, 'stopped');

  const stopped = [];
  const hosts = new GatewayHostSupervisor({ maxRssBytes: 100 });
  hosts.register({ id: 'h1', stop: async () => stopped.push('h1') });
  hosts.sample('h1', { rssBytes: 101 });
  assert.equal((await hosts.drain('h1', 'memory-budget')).state, 'stopped');
  assert.deepEqual(stopped, ['h1']);

  const projection = new GatewayTuiProjection();
  const view = projection.project({ adapters: [{ id: 'a', state: 'running', credentialRef: 'vault://x' }], queueDepth: 2, lastError: new Error('oops') });
  assert.equal(view.adapters[0].credentialRef, undefined);
  assert.equal(view.queueDepth, 2);
  assert.equal(view.lastError, 'oops');
});
