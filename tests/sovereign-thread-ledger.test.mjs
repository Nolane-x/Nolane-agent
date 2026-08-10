import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SovereignThreadLedger } from '../src/kernel/thread-ledger.mjs';

test('sovereign thread ledger fences concurrent writers and resumes from checkpoints with a new epoch', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nolane-kernel-ledger-'));
  let now = Date.parse('2026-08-03T00:00:00Z');
  const ledger = new SovereignThreadLedger({ file: path.join(dir, 'ledger.db'), clock: () => now++ });
  t.after(async () => {
    ledger.close();
    await rm(dir, { recursive: true, force: true });
  });
  const thread = ledger.createThread({ id: 'thread-a', projectId: 'project-a', principalId: 'user-a', objective: 'Refactor the agent kernel', labels: ['core'] });
  assert.equal(thread.revision, 1);
  assert.equal(thread.state, 'running');
  assert.equal(ledger.timeline(thread.id).length, 1);
  const event = ledger.appendEvent({ threadId: thread.id, type: 'plan.created', actor: 'planner', payload: { tasks: 3 }, expectedRevision: thread.revision, epoch: thread.epoch });
  assert.equal(event.revision, 2);
  assert.throws(() => ledger.appendEvent({ threadId: thread.id, type: 'stale', actor: 'planner', expectedRevision: 1, epoch: thread.epoch }), /revision mismatch/i);
  const current = ledger.getThread(thread.id);
  const checkpoint = ledger.checkpoint(thread.id, { label: 'before execution', snapshot: { planId: 'plan-1' }, expectedRevision: current.revision, epoch: current.epoch });
  assert.equal(checkpoint.snapshot.planId, 'plan-1');
  const afterCheckpoint = ledger.getThread(thread.id);
  ledger.transition(thread.id, 'failed', { actor: 'runner', reason: 'synthetic failure', expectedRevision: afterCheckpoint.revision, epoch: afterCheckpoint.epoch });
  const failed = ledger.getThread(thread.id);
  assert.equal(failed.state, 'failed');
  const resumed = ledger.resumeFromCheckpoint(checkpoint.id, { actor: 'operator' });
  assert.equal(resumed.thread.state, 'running');
  assert.notEqual(resumed.thread.epoch, failed.epoch);
  assert.throws(() => ledger.appendEvent({ threadId: thread.id, type: 'old-epoch', actor: 'runner', epoch: failed.epoch }), /epoch is stale/i);
  assert.match(ledger.snapshot(thread.id).receiptSha256, /^[a-f0-9]{64}$/);
});
