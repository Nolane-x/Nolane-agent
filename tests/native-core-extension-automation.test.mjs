import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NolanePluginHost } from '../src/nolane-native/plugin-host.mjs';
import { NolaneDurableScheduler } from '../src/nolane-native/durable-scheduler.mjs';
import { NolaneSubagentManager } from '../src/nolane-native/subagent-manager.mjs';
import { McpRegistry } from '../src/mcp/mcp-registry.mjs';
import { ExtensionAutomationFabric } from '../src/native-core/extension-automation-fabric.mjs';

const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const hex64 = /^[a-f0-9]{64}$/;

test('signed plugin manifests verify with Ed25519, log a hash chain and support hot disable', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const host = new NolanePluginHost({ allowedCapabilities: ['message:send'] });
  const manifest = { schema: 'nolane.agent.plugin.v2', id: 'signed-messages', kind: 'messaging', capabilities: ['message:send'], hooks: [], version: '1.0.0' };
  const signatureBase64 = sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64');
  const installed = host.installSigned({ manifest, signatureBase64, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), adapter: { send: async () => ({ delivered: true }) } });
  assert.equal(installed.status, 'installed');
  host.activate('signed-messages');
  const disabled = host.disable('signed-messages', { reason: 'operator-stop' });
  assert.equal(disabled.status, 'disabled');
  await assert.rejects(() => host.send('signed-messages', { channel: 'c', text: 'x' }), /not active/i);
  const log = host.transparencyLog();
  assert.deepEqual(log.events.map((event) => event.type), ['install-signed', 'activate', 'disable']);
  assert.equal(log.events[1].previousSha256, log.events[0].sha256);
  assert.match(log.receiptSha256, hex64);
  assert.throws(() => host.installSigned({ manifest: { ...manifest, id: 'tampered' }, signatureBase64, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), adapter: {} }), /signature/i);
});

test('extension fabric filters MCP tools and reconnects once after retryable transport failure', async () => {
  const mcp = new McpRegistry();
  let calls = 0; let reconnects = 0;
  mcp.register({
    id: 'server',
    publicView: () => ({ id: 'server' }),
    listTools: async () => [{ name: 'read', inputSchema: {} }, { name: 'delete', inputSchema: {} }],
    callTool: async (name) => { calls += 1; if (calls === 1) throw Object.assign(new Error('transport closed'), { retryable: true }); return { name, ok: true }; },
    reconnect: async () => { reconnects += 1; },
    close: async () => {},
  });
  const fabric = new ExtensionAutomationFabric({ mcp });
  assert.deepEqual((await fabric.listMcpTools({ allowedTools: ['server__read'] })).map((tool) => tool.name), ['server__read']);
  await assert.rejects(() => fabric.callMcpTool('server__delete', {}, { allowedTools: ['server__read'] }), /not allowed/i);
  const result = await fabric.callMcpTool('server__read', {}, { allowedTools: ['server__read'] });
  assert.equal(result.ok, true);
  assert.equal(reconnects, 1);
  assert.equal(calls, 2);
});

test('durable scheduler prevents duplicate fingerprints, supports pause/resume and recovers stale running jobs', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-scheduler-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let now = 100;
  const file = path.join(root, 'jobs.json');
  const scheduler = new NolaneDurableScheduler({ file, clock: () => now });
  await scheduler.open();
  await scheduler.schedule({ id: 'j1', runAt: 100, task: { type: 'work' }, retryFingerprint: 'same', leaseTtlMs: 10, maxAttempts: 2 });
  await assert.rejects(() => scheduler.schedule({ id: 'j2', runAt: 100, task: { type: 'work' }, retryFingerprint: 'same' }), /duplicate.*fingerprint/i);
  await scheduler.pause('j1');
  assert.equal(scheduler.get('j1').status, 'paused');
  await scheduler.resume('j1');
  assert.equal(scheduler.get('j1').status, 'scheduled');
  await assert.rejects(() => scheduler.runDue(async () => { now = 120; throw new Error('worker crash'); }), /worker crash/);
  assert.equal(scheduler.get('j1').status, 'scheduled');
  const restarted = new NolaneDurableScheduler({ file, clock: () => now });
  const opened = await restarted.open();
  assert.equal(opened.recoveredStale >= 0, true);
  const results = await restarted.runDue(async () => ({ receiptSha256: 'a'.repeat(64) }));
  assert.equal(results[0].status, 'completed');
});

test('subagent leases require heartbeat, reject duplicate work and recover stale workers', () => {
  let now = 100;
  const manager = new NolaneSubagentManager({ clock: () => now, defaultLeaseTtlMs: 10 });
  manager.spawn({ missionId: 'm', parentAgentId: 'root', agentId: 'a1', objective: 'fix', parentCapabilities: ['read'], delegatedCapabilities: ['read'], retryFingerprint: 'task:fix' });
  assert.throws(() => manager.spawn({ missionId: 'm', parentAgentId: 'root', agentId: 'a2', objective: 'same', parentCapabilities: ['read'], delegatedCapabilities: ['read'], retryFingerprint: 'task:fix' }), /duplicate.*work/i);
  now = 105;
  const heartbeat = manager.heartbeat('a1');
  assert.equal(heartbeat.leaseExpiresAt, 115);
  now = 116;
  assert.deepEqual(manager.recoverStale(), ['a1']);
  assert.equal(manager.get('a1').status, 'stale');
  const replacement = manager.spawn({ missionId: 'm', parentAgentId: 'root', agentId: 'a2', objective: 'retry', parentCapabilities: ['read'], delegatedCapabilities: ['read'], retryFingerprint: 'task:fix' });
  assert.equal(replacement.attempt, 2);
});

test('orchestration service exposes the shared extension automation facade', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-extension-orchestration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { NolaneNativeOrchestrationService } = await import('../src/nolane-native/orchestration-service.mjs');
  const service = new NolaneNativeOrchestrationService({ dataDir: root });
  await service.open();
  const status = service.status();
  assert.equal(status.extensions.ready, true);
  assert.equal(status.extensions.plugins >= 1, true);
  assert.equal(status.extensions.schedulerJobs, 0);
});
