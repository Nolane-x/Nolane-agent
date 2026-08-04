import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { McpOAuthRuntime } from '../src/native-core/mcp-oauth-runtime.mjs';
import { BrowserSupervisorRuntime } from '../src/native-core/browser-supervisor-runtime.mjs';
import { AsyncDelegationRuntime } from '../src/native-core/async-delegation-runtime.mjs';
import { PtySessionRuntime } from '../src/native-core/pty-session-runtime.mjs';
import { GatewayRecoveryRuntime } from '../src/native-core/gateway-recovery-runtime.mjs';
import { LocalMediaPipelineRuntime } from '../src/native-core/local-media-pipeline-runtime.mjs';

const temp = async () => fs.mkdtemp(path.join(os.tmpdir(), 'nolane-wave6-'));

test('MCP OAuth runtime uses one-time PKCE state, stores only credential references and recovers restart state', async () => {
  const root = await temp();
  let now = 1_000;
  const file = path.join(root, 'mcp-oauth.json');
  const runtime = new McpOAuthRuntime({ file, clock: () => now, randomBytes: (n) => Buffer.alloc(n, 7) });
  await runtime.open();
  const begun = await runtime.begin({ serverId: 'docs', authorizationEndpoint: 'https://auth.example.com/authorize', tokenEndpoint: 'https://auth.example.com/token', redirectUri: 'http://127.0.0.1:43123/callback', clientId: 'nolane', scopes: ['read'] });
  assert.match(begun.codeChallenge, /^[A-Za-z0-9_-]+$/);
  const completed = await runtime.complete({ state: begun.state, code: 'authorization-code', credentialRef: 'vault://mcp/docs' });
  assert.equal(completed.serverId, 'docs');
  await assert.rejects(() => runtime.complete({ state: begun.state, code: 'replay', credentialRef: 'vault://mcp/docs' }), /state.*used|unknown state/i);
  const reopened = new McpOAuthRuntime({ file, clock: () => now });
  await reopened.open();
  assert.equal(reopened.connection('docs').credentialRef, 'vault://mcp/docs');
  assert.equal(JSON.stringify(reopened.snapshot()).includes('authorization-code'), false);
  assert.equal(JSON.stringify(reopened.snapshot()).includes('codeVerifier'), false);
});

test('browser supervisor serializes actions, queues dialogs, times out leases and recovers crashed contexts', async () => {
  let now = 10;
  const calls = [];
  const runtime = new BrowserSupervisorRuntime({ clock: () => now, actionTimeoutMs: 25 });
  runtime.registerContext({ id: 'ctx', driver: { async execute(action) { calls.push(action); return { observed: true, value: action.type }; }, async close() { calls.push({ type: 'close' }); } } });
  await runtime.start('ctx');
  const dialog = runtime.enqueueDialog('ctx', { type: 'confirm', message: 'Delete?' });
  assert.throws(() => runtime.resolveDialog('ctx', { dialogId: 'wrong', accept: true }), /unknown dialog/);
  assert.equal(runtime.resolveDialog('ctx', { dialogId: dialog.dialogId, accept: false }).accepted, false);
  const result = await runtime.execute('ctx', { type: 'click', selector: '#save' });
  assert.equal(result.effect.observed, true);
  runtime.markCrashed('ctx', { reason: 'renderer-gone' });
  assert.equal(runtime.snapshot().contexts[0].state, 'crashed');
  await runtime.recover('ctx');
  assert.equal(runtime.snapshot().contexts[0].state, 'running');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('async delegation runtime persists bounded live logs, rejects stale workers and requires verified completion', async () => {
  const root = await temp();
  let now = 100;
  const file = path.join(root, 'delegation.json');
  const runtime = new AsyncDelegationRuntime({ file, clock: () => now, maxLogEntries: 2 });
  await runtime.open();
  const task = await runtime.spawn({ id: 'task-1', missionId: 'mission', objective: 'Review', workerId: 'worker-a', leaseMs: 10 });
  await runtime.appendLog(task.id, { workerId: 'worker-a', message: 'one' });
  await runtime.appendLog(task.id, { workerId: 'worker-a', message: 'two' });
  await runtime.appendLog(task.id, { workerId: 'worker-a', message: 'three' });
  assert.equal(runtime.get(task.id).log.length, 2);
  now = 200;
  const recovered = await runtime.recoverStale({ replacementWorkerId: 'worker-b', leaseMs: 20 });
  assert.deepEqual(recovered, ['task-1']);
  await assert.rejects(() => runtime.complete(task.id, { workerId: 'worker-a', result: {}, verification: { verified: true, receiptSha256: 'a'.repeat(64) } }), /worker mismatch/);
  await assert.rejects(() => runtime.complete(task.id, { workerId: 'worker-b', result: {}, verification: { verified: false } }), /verified completion/);
  const done = await runtime.complete(task.id, { workerId: 'worker-b', result: { ok: true }, verification: { verified: true, independent: true, receiptSha256: 'b'.repeat(64) } });
  assert.equal(done.state, 'completed');
});

test('PTY session runtime serializes input, bounds replay and applies deterministic turn retry policy', async () => {
  const events = [];
  const runtime = new PtySessionRuntime({ maxReplayEvents: 3, backend: {
    async start(spec) { events.push(['start', spec.command]); return { pid: 7 }; },
    async write(id, data) { events.push(['write', id, data]); },
    async resize(id, size) { events.push(['resize', id, size.cols]); },
    async stop(id) { events.push(['stop', id]); },
  } });
  const session = await runtime.start({ id: 'pty-1', command: 'node', args: ['-v'] });
  await runtime.write(session.id, 'hello');
  await runtime.resize(session.id, { cols: 120, rows: 30 });
  runtime.recordOutput(session.id, { stream: 'stdout', data: 'a' });
  runtime.recordOutput(session.id, { stream: 'stdout', data: 'b' });
  runtime.recordOutput(session.id, { stream: 'stdout', data: 'c' });
  runtime.recordOutput(session.id, { stream: 'stdout', data: 'd' });
  assert.equal(runtime.replay(session.id).events.length, 3);
  assert.deepEqual(runtime.nextRetry({ attempt: 1, maxAttempts: 3, errorClass: 'rate_limit', retryAfterMs: 500 }), { retry: true, delayMs: 500, attempt: 2 });
  assert.equal(runtime.nextRetry({ attempt: 3, maxAttempts: 3, errorClass: 'rate_limit' }).retry, false);
  await runtime.stop(session.id);
  assert.equal(runtime.snapshot().sessions[0].state, 'stopped');
});

test('gateway recovery runtime tracks liveness, memory pressure, drain shutdown and tamper-evident forensics', async () => {
  let now = 1_000;
  const runtime = new GatewayRecoveryRuntime({ clock: () => now, heartbeatTimeoutMs: 50, memoryLimitBytes: 100 });
  runtime.registerHost({ id: 'gateway-1', stop: async () => ({ stopped: true }) });
  runtime.heartbeat('gateway-1', { rssBytes: 50 });
  assert.equal(runtime.health('gateway-1').healthy, true);
  runtime.sampleMemory('gateway-1', { rssBytes: 150 });
  assert.equal(runtime.health('gateway-1').pressure, true);
  now = 2_000;
  assert.equal(runtime.health('gateway-1').healthy, false);
  const shutdown = await runtime.shutdown('gateway-1', { reason: 'release', drainMs: 0 });
  assert.equal(shutdown.state, 'stopped');
  assert.match(runtime.forensics('gateway-1').headSha256, /^[a-f0-9]{64}$/);
});

test('local media pipeline stores content-addressed assets and supports playback queue, pause and barge-in', async () => {
  const root = await temp();
  const runtime = new LocalMediaPipelineRuntime({ directory: root, maxAssetBytes: 64 });
  await runtime.open();
  const asset = await runtime.put({ mimeType: 'image/png', bytes: Buffer.from('fake-png'), metadata: { prompt: 'cat', apiKey: 'secret' } });
  assert.equal(asset.id.length, 64);
  assert.equal((await runtime.get(asset.id)).bytes.toString(), 'fake-png');
  runtime.enqueuePlayback({ assetId: asset.id, kind: 'audio', durationMs: 1000 });
  runtime.startPlayback();
  runtime.pausePlayback();
  const barged = runtime.bargeIn({ reason: 'user-speaking' });
  assert.equal(barged.interrupted, true);
  assert.equal(JSON.stringify(runtime.snapshot()).includes('secret'), false);
  await assert.rejects(() => runtime.put({ mimeType: 'video/mp4', bytes: Buffer.alloc(100) }), /byte budget/);
});
