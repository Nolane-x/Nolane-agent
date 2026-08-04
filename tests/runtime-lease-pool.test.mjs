import assert from 'node:assert/strict';
import test from 'node:test';

import { RuntimeLeasePool } from '../src/runtime/runtime-lease-pool.mjs';

function governor(state = 'normal', limit = 2) {
  let currentState = state;
  let currentLimit = limit;
  return {
    snapshot() { return { state: currentState, policy: { maxActiveAgents: currentLimit, maxBrowserSessions: currentLimit } }; },
    set(nextState, nextLimit = currentLimit) { currentState = nextState; currentLimit = nextLimit; },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('RuntimeLeasePool enforces global and per-key limits with FIFO fairness', async () => {
  const pool = new RuntimeLeasePool({ kind: 'provider', governor: governor('normal', 2), policyKey: 'maxActiveAgents', maxPerKey: 1 });
  const first = await pool.acquire({ key: 'claude', missionId: 'm1', taskId: 't1' });
  const order = [];
  const secondPromise = pool.acquire({ key: 'claude', missionId: 'm1', taskId: 't2' }).then((lease) => { order.push('second'); return lease; });
  const third = await pool.acquire({ key: 'codex', missionId: 'm2', taskId: 't3' });
  const fourthPromise = pool.acquire({ key: 'gemini', missionId: 'm3', taskId: 't4' }).then((lease) => { order.push('fourth'); return lease; });
  await tick();
  assert.deepEqual(order, []);
  first.release();
  const second = await secondPromise;
  assert.deepEqual(order, ['second']);
  await tick();
  assert.deepEqual(order, ['second']);
  third.release();
  const fourth = await fourthPromise;
  assert.deepEqual(order, ['second', 'fourth']);
  second.release(); fourth.release();
  assert.equal(pool.snapshot().active, 0);
});

test('RuntimeLeasePool attributes active and queued leases to missions and tasks', async () => {
  const pool = new RuntimeLeasePool({ kind: 'provider', governor: governor('normal', 1), policyKey: 'maxActiveAgents' });
  const active = await pool.acquire({ key: 'codex', missionId: 'mission-a', taskId: 'task-a', metadata: { role: 'executor' } });
  const queuedPromise = pool.acquire({ key: 'claude', missionId: 'mission-b', taskId: 'task-b' });
  await tick();
  const snapshot = pool.snapshot();
  assert.equal(snapshot.active, 1);
  assert.equal(snapshot.queued, 1);
  assert.deepEqual(snapshot.missions, [
    { missionId: 'mission-a', active: 1, queued: 0 },
    { missionId: 'mission-b', active: 0, queued: 1 },
  ]);
  assert.equal(snapshot.leases[0].taskId, 'task-a');
  active.release();
  (await queuedPromise).release();
});

test('RuntimeLeasePool removes an aborted waiter without leaking capacity', async () => {
  const pool = new RuntimeLeasePool({ kind: 'provider', governor: governor('normal', 1), policyKey: 'maxActiveAgents' });
  const active = await pool.acquire({ key: 'codex' });
  const controller = new AbortController();
  const queued = pool.acquire({ key: 'claude', signal: controller.signal });
  controller.abort(new Error('cancelled by test'));
  await assert.rejects(queued, /cancelled by test/);
  assert.equal(pool.snapshot().queued, 0);
  active.release();
  const next = await pool.acquire({ key: 'gemini' });
  next.release();
});

test('RuntimeLeasePool rejects new work when policy capacity is zero', async () => {
  const runtimeGovernor = governor('emergency', 0);
  const pool = new RuntimeLeasePool({ kind: 'provider', governor: runtimeGovernor, policyKey: 'maxActiveAgents' });
  await assert.rejects(
    pool.acquire({ key: 'codex', missionId: 'm1' }),
    (error) => error.code === 'RUNTIME_LEASE_ADMISSION_BLOCKED' && /emergency/.test(error.message),
  );
  assert.equal(pool.snapshot().queued, 0);
});

test('RuntimeLeasePool run releases exactly once on success and failure', async () => {
  const pool = new RuntimeLeasePool({ kind: 'browser', governor: governor('normal', 1), policyKey: 'maxBrowserSessions' });
  const value = await pool.run({ key: 'project-a' }, async (lease) => lease.key);
  assert.equal(value, 'project-a');
  await assert.rejects(pool.run({ key: 'project-a' }, async () => { throw new Error('boom'); }), /boom/);
  assert.equal(pool.snapshot().active, 0);
});

test('RuntimeLeasePool evicts idle key records and bounds its receipt journal', async () => {
  let now = 1_000;
  const events = [];
  const pool = new RuntimeLeasePool({ kind: 'provider', governor: governor('normal', 1), policyKey: 'maxActiveAgents', idleTtlMs: 100, maxJournal: 3, clock: () => now, eventSink: (event) => events.push(event) });
  for (const key of ['a', 'b', 'c']) {
    const lease = await pool.acquire({ key });
    lease.release();
    now += 10;
  }
  assert.equal(pool.snapshot().journal.length, 3);
  assert.ok(pool.snapshot().journal.every((entry) => /^[a-f0-9]{64}$/.test(entry.receiptSha256)));
  now += 200;
  const swept = pool.sweep();
  assert.equal(swept.evictedKeys, 3);
  assert.equal(pool.snapshot().keys.length, 0);
  assert.ok(events.length >= 6);
  pool.close();
  await assert.rejects(pool.acquire({ key: 'd' }), (error) => error.code === 'RUNTIME_LEASE_POOL_CLOSED');
});
