import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderSessionHost } from '../src/providers/provider-session-host.mjs';

function governor(initial = 'normal') {
  let state = initial;
  return { snapshot: () => ({ state }), set: (next) => { state = next; } };
}

function persistentProvider() {
  let opens = 0; let closes = 0; let completes = 0; let oneShots = 0;
  return {
    id: 'persistent',
    sessionCapabilities: () => ({ logicalSessions: true, persistentProcess: true }),
    async openSession() { opens += 1; return { id: `session-${opens}` }; },
    async completeInSession(session, request) { completes += 1; return { providerId: 'persistent', text: `${session.id}:${request.messages[0].content}` }; },
    async closeSession() { closes += 1; },
    async complete(request) { oneShots += 1; return { providerId: 'persistent', text: `one:${request.messages[0].content}` }; },
    counts: () => ({ opens, closes, completes, oneShots }),
  };
}

test('ProviderSessionHost reuses only protocol-supported logical sessions', async () => {
  const provider = persistentProvider();
  const host = new ProviderSessionHost({ governor: governor(), maxUses: 8 });
  const first = await host.complete({ provider, request: { messages: [{ role: 'user', content: 'one' }] }, scope: { projectId: 'p1', missionId: 'm1' }, fingerprint: 'fp-a' });
  const second = await host.complete({ provider, request: { messages: [{ role: 'user', content: 'two' }] }, scope: { projectId: 'p1', missionId: 'm1' }, fingerprint: 'fp-a' });
  assert.equal(first.sessionHost.reused, false);
  assert.equal(second.sessionHost.reused, true);
  assert.equal(first.sessionHost.sessionId, second.sessionHost.sessionId);
  assert.deepEqual(provider.counts(), { opens: 1, closes: 0, completes: 2, oneShots: 0 });
  assert.equal(host.snapshot().sessions.length, 1);
});

test('ProviderSessionHost invalidates stale fingerprints and enforces maximum uses', async () => {
  const provider = persistentProvider();
  const host = new ProviderSessionHost({ governor: governor(), maxUses: 2 });
  const input = (fingerprint, text) => ({ provider, request: { messages: [{ role: 'user', content: text }] }, scope: { projectId: 'p1', missionId: 'm1' }, fingerprint });
  await host.complete(input('fp-a', 'one'));
  await host.complete(input('fp-a', 'two'));
  const afterMax = await host.complete(input('fp-a', 'three'));
  assert.equal(afterMax.sessionHost.reused, false);
  const stale = await host.complete(input('fp-b', 'four'));
  assert.equal(stale.sessionHost.reused, false);
  assert.deepEqual(provider.counts(), { opens: 3, closes: 2, completes: 4, oneShots: 0 });
  assert.ok(host.snapshot().journal.some((item) => item.type === 'provider-session.invalidated' && item.reason === 'fingerprint-changed'));
});

test('ProviderSessionHost falls back honestly for one-shot providers', async () => {
  let calls = 0;
  const provider = { id: 'cli', async complete() { calls += 1; return { providerId: 'cli', text: 'ok' }; } };
  const host = new ProviderSessionHost({ governor: governor() });
  const result = await host.complete({ provider, request: {}, scope: { missionId: 'm1' }, fingerprint: 'x' });
  assert.equal(result.sessionHost.mode, 'one-shot');
  assert.equal(result.sessionHost.reused, false);
  assert.equal(calls, 1);
  assert.equal(host.snapshot().sessions.length, 0);
});

test('ProviderSessionHost evicts idle sessions and blocks new warm sessions under pressure', async () => {
  const runtime = governor('normal');
  const provider = persistentProvider();
  const host = new ProviderSessionHost({ governor: runtime });
  const base = { provider, request: { messages: [{ role: 'user', content: 'one' }] }, scope: { missionId: 'm1' }, fingerprint: 'fp' };
  await host.complete(base);
  runtime.set('pressure');
  const eviction = await host.applyGovernorState();
  assert.equal(eviction.evicted, 1);
  const pressured = await host.complete(base);
  assert.equal(pressured.sessionHost.mode, 'one-shot-pressure');
  assert.deepEqual(provider.counts(), { opens: 1, closes: 1, completes: 1, oneShots: 1 });
});

test('ProviderSessionHost attributes a persistent provider process to the mission ledger', async () => {
  const calls = [];
  const ledger = {
    register(input) { calls.push(['register', input]); return { id: 'ledger-1' }; },
    finalize(id, reason) { calls.push(['finalize', { id, reason }]); return { id }; },
  };
  const provider = {
    id: 'codex-app-server',
    sessionCapabilities: () => ({ logicalSessions: true }),
    processDescriptor: () => ({ rootPid: 4321, metadata: { executable: 'codex', kind: 'app-server' } }),
    async openSession() { return { id: 'thread-1' }; },
    async completeInSession() { return { text: 'ok' }; },
    async closeSession() {},
    async complete() { return { text: 'one-shot' }; },
  };
  const host = new ProviderSessionHost({ governor: { snapshot: () => ({ state: 'normal' }) }, processLedger: ledger });
  await host.complete({ provider, scope: { projectId: 'p1', missionId: 'm1', taskId: 't1' }, fingerprint: 'repo-a' });
  assert.deepEqual(calls[0], ['register', { rootPid: 4321, projectId: 'p1', missionId: 'm1', taskId: 't1', providerId: 'codex-app-server', sessionId: 'thread-1', metadata: { executable: 'codex', kind: 'app-server' } }]);
  await host.close();
  assert.deepEqual(calls[1], ['finalize', { id: 'ledger-1', reason: 'host-closed' }]);
});
