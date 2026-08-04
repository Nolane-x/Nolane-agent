import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SqliteA2aTaskStore } from '../src/storage/sqlite-a2a-task-store.mjs';
import { A2aTaskScheduler } from '../src/server/a2a-task-store.mjs';

function task(id='task-1') {
  const stamp = new Date().toISOString();
  return { id, ownerPrincipalId: 'issuer|tenant|user', createdAt: stamp, lastModified: stamp, status: { state: 'TASK_STATE_SUBMITTED', timestamp: stamp }, statusHistory: [{ state: 'TASK_STATE_SUBMITTED', timestamp: stamp }], artifacts: [], metadata: { deferred: true, attempt: 0, lease: null } };
}

test('SQLite A2A task store provides revisioned cross-instance transactions and scheduler leases', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-a2a-sqlite-'));
  const file = path.join(root, 'forgeos.db');
  const first = new SqliteA2aTaskStore(file);
  const second = new SqliteA2aTaskStore(file);
  try {
    const created = await first.create(task());
    const results = await Promise.allSettled([
      first.update(created.id, (current) => ({ ...current, metadata: { ...current.metadata, a: 1 } }), { expectedRevision: 0 }),
      second.update(created.id, (current) => ({ ...current, metadata: { ...current.metadata, b: 1 } }), { expectedRevision: 0 }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const scheduler = new A2aTaskScheduler(first, { leaseMs: 1000 });
    const leased = await scheduler.leaseNext({ workerId: 'worker-1' });
    assert.ok(leased?.token);
    const completed = await scheduler.complete(created.id, leased.token, { result: { ok: true } });
    assert.equal(completed.status.state, 'TASK_STATE_COMPLETED');
    assert.equal((await second.list()).length, 1);
    assert.equal((await first.health()).ok, true);
  } finally {
    first.close(); second.close();
    await rm(root, { recursive: true, force: true });
  }
});
