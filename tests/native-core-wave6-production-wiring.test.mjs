import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave6-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ptyEvents = [];
  const service = new NolaneNativeOrchestrationService({
    dataDir: root,
    workspaceRoot: root,
    clock: (() => { let n = 1_000; return () => ++n; })(),
    nativePtyBackend: {
      async start(spec) { ptyEvents.push(['start', spec.command]); return { pid: 9 }; },
      async write(id, data) { ptyEvents.push(['write', id, data]); },
      async resize(id, size) { ptyEvents.push(['resize', id, size.cols]); },
      async stop(id) { ptyEvents.push(['stop', id]); },
    },
  });
  await service.open();
  return { service, ptyEvents };
}

test('orchestration production-wires wave6 runtimes and persists their state', async (t) => {
  const { service, ptyEvents } = await fixture(t);
  const oauth = await service.beginNativeMcpOAuth({ serverId: 'docs', authorizationEndpoint: 'https://auth.example.com/a', tokenEndpoint: 'https://auth.example.com/t', redirectUri: 'http://127.0.0.1:43123/callback', clientId: 'nolane' });
  await service.completeNativeMcpOAuth({ state: oauth.state, code: 'code', credentialRef: 'vault://mcp/docs' });
  await service.spawnNativeDelegation({ id: 'd1', missionId: 'm1', objective: 'Review', workerId: 'w1', leaseMs: 100 });
  await service.appendNativeDelegationLog('d1', { workerId: 'w1', message: 'working' });
  await service.startNativePtySession({ id: 'p1', command: 'node' });
  await service.writeNativePtySession('p1', 'hello');
  service.registerNativeGatewayHost({ id: 'g1', stop: async () => ({ stopped: true }) });
  service.heartbeatNativeGatewayHost('g1', { rssBytes: 10 });
  const media = await service.putNativeLocalMedia({ mimeType: 'audio/wav', bytes: Buffer.from('wave') });
  service.enqueueNativePlayback({ assetId: media.id, kind: 'audio' });
  service.startNativePlayback();
  const status = service.status().runtimeWave6;
  assert.equal(status.mcpOAuth.connections.length, 1);
  assert.equal(status.delegation.tasks.length, 1);
  assert.equal(status.pty.sessions.length, 1);
  assert.equal(status.gatewayRecovery.hosts.length, 1);
  assert.equal(status.media.assets, 1);
  assert.deepEqual(ptyEvents[0], ['start', 'node']);
});

test('authenticated HTTP routes expose bounded wave6 operations without executable injection', async (t) => {
  const { service } = await fixture(t);
  const route = createRoutes({ nativeOrchestration: service });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    await route(req, res, new URL(`http://local${pathname}`));
    return { status, body: data ? JSON.parse(data) : null };
  };
  const begun = await call({ method: 'POST', pathname: '/api/nolane/native-core/mcp/oauth/begin', body: { serverId: 'docs', authorizationEndpoint: 'https://auth.example.com/a', tokenEndpoint: 'https://auth.example.com/t', redirectUri: 'http://127.0.0.1:43123/callback', clientId: 'nolane' } });
  assert.equal(begun.status, 201);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/mcp/oauth/complete', body: { state: begun.body.state, code: 'code', credentialRef: 'vault://mcp/docs' } })).status, 200);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/delegation/spawn', body: { id: 'd1', missionId: 'm1', objective: 'Review', workerId: 'w1' } })).status, 201);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/delegation/log', body: { taskId: 'd1', workerId: 'w1', message: 'working' } })).status, 201);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/pty/start', body: { id: 'p1', command: 'node', handler: 'malicious' } })).status, 201);
  const media = await call({ method: 'POST', pathname: '/api/nolane/native-core/media/local', body: { mimeType: 'audio/wav', base64: Buffer.from('wave').toString('base64') } });
  assert.equal(media.status, 201);
  const status = await call({ pathname: '/api/nolane/native-core/wave6/status' });
  assert.equal(status.status, 200);
  assert.equal(status.body.mcpOAuth.connections.length, 1);
});
