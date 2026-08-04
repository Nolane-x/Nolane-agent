import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryIntelligenceScheduler } from '../src/repository/repository-intelligence-scheduler.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function governor({ state = 'normal', semanticIndexing = 'incremental' } = {}) {
  return { snapshot: () => ({ state, policy: { semanticIndexing } }) };
}

const project = (id) => ({ id, workspaceRoot: `/tmp/${id}` });

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(Boolean(predicate()), true, 'condition did not become true');
}

test('RepositoryIntelligenceScheduler runs higher-priority queued work first while preserving one active job per project', async () => {
  const blocker = deferred();
  const order = [];
  const scheduler = new RepositoryIntelligenceScheduler({
    governor: governor(),
    maxWorkers: 1,
    runners: {
      lexical: async (item) => {
        order.push(item.id);
        if (item.id === 'blocker') await blocker.promise;
        return { projectId: item.id };
      },
    },
  });
  const active = scheduler.enqueue({ project: project('blocker'), generation: 'g1', priority: 'background', stages: ['lexical'] });
  await waitFor(() => order.includes('blocker'));
  const low = scheduler.enqueue({ project: project('low'), generation: 'g1', priority: 'background', stages: ['lexical'] });
  const high = scheduler.enqueue({ project: project('high'), generation: 'g1', priority: 'interactive', stages: ['lexical'] });
  blocker.resolve();
  await Promise.all([active, low, high]);
  assert.deepEqual(order, ['blocker', 'high', 'low']);
  scheduler.close();
});

test('RepositoryIntelligenceScheduler coalesces duplicate project generation and stage requests', async () => {
  const gate = deferred();
  let calls = 0;
  const scheduler = new RepositoryIntelligenceScheduler({
    governor: governor(),
    maxWorkers: 1,
    runners: { lexical: async () => { calls += 1; await gate.promise; return { indexed: 1 }; } },
  });
  const first = scheduler.enqueue({ project: project('p1'), generation: 'same', stages: ['lexical'] });
  const second = scheduler.enqueue({ project: project('p1'), generation: 'same', stages: ['lexical'] });
  await waitFor(() => calls === 1);
  gate.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(a.jobId, b.jobId);
  assert.equal(a.receiptSha256, b.receiptSha256);
  scheduler.close();
});

test('RepositoryIntelligenceScheduler rejects stale queued generations when newer repository evidence arrives', async () => {
  const gate = deferred();
  const scheduler = new RepositoryIntelligenceScheduler({
    governor: governor(),
    maxWorkers: 1,
    runners: { lexical: async (item) => { if (item.id === 'blocker') await gate.promise; return { projectId: item.id }; } },
  });
  const active = scheduler.enqueue({ project: project('blocker'), generation: 'g1', stages: ['lexical'] });
  await waitFor(() => scheduler.snapshot().active === 1);
  const stale = scheduler.enqueue({ project: project('p1'), generation: 'g1', priority: 'background', stages: ['lexical'] });
  const fresh = scheduler.enqueue({ project: project('p1'), generation: 'g2', priority: 'mission', stages: ['lexical'] });
  await assert.rejects(stale, (error) => error?.code === 'REPOSITORY_INDEX_STALE');
  gate.resolve();
  const result = await fresh;
  await active;
  assert.equal(result.generation, 'g2');
  assert.ok(scheduler.snapshot('p1').journal.some((entry) => entry.type === 'repository-index.stale-cancelled'));
  scheduler.close();
});

test('RepositoryIntelligenceScheduler applies governor semantic policy without blocking required lexical evidence', async () => {
  const calls = [];
  const onDemand = new RepositoryIntelligenceScheduler({
    governor: governor({ state: 'pressure', semanticIndexing: 'on-demand' }),
    runners: {
      lexical: async () => { calls.push('lexical'); return { ok: true }; },
      semantic: async () => { calls.push('semantic'); return { ok: true }; },
    },
  });
  const watcher = await onDemand.enqueue({ project: project('p1'), generation: 'g1', priority: 'watcher', stages: ['lexical', 'semantic'] });
  assert.deepEqual(calls, ['lexical']);
  assert.deepEqual(watcher.skippedStages, [{ stage: 'semantic', reason: 'semantic-on-demand' }]);
  await onDemand.enqueue({ project: project('p1'), generation: 'g2', priority: 'mission', stages: ['lexical', 'semantic'] });
  assert.deepEqual(calls, ['lexical', 'lexical', 'semantic']);
  onDemand.close();

  const suspendedCalls = [];
  const suspended = new RepositoryIntelligenceScheduler({
    governor: governor({ state: 'emergency', semanticIndexing: 'suspended' }),
    allowEssentialInEmergency: true,
    runners: {
      lexical: async () => { suspendedCalls.push('lexical'); return { ok: true }; },
      semantic: async () => { suspendedCalls.push('semantic'); return { ok: true }; },
    },
  });
  const result = await suspended.enqueue({ project: project('p2'), generation: 'g1', priority: 'interactive', stages: ['lexical', 'semantic'] });
  assert.deepEqual(suspendedCalls, ['lexical']);
  assert.deepEqual(result.skippedStages, [{ stage: 'semantic', reason: 'semantic-suspended' }]);
  suspended.close();
});

test('RepositoryIntelligenceScheduler removes aborted queued work and emits bounded receipt-backed journal entries', async () => {
  const gate = deferred();
  let now = 100;
  const scheduler = new RepositoryIntelligenceScheduler({
    governor: governor(),
    maxWorkers: 1,
    maxJournal: 4,
    clock: () => ++now,
    runners: { lexical: async (item) => { if (item.id === 'blocker') await gate.promise; return { ok: true }; } },
  });
  const active = scheduler.enqueue({ project: project('blocker'), generation: 'g1', stages: ['lexical'] });
  await waitFor(() => scheduler.snapshot().active === 1);
  const controller = new AbortController();
  const queued = scheduler.enqueue({ project: project('abort-me'), generation: 'g1', stages: ['lexical'], signal: controller.signal });
  controller.abort(new Error('user cancelled indexing'));
  await assert.rejects(queued, /user cancelled indexing/);
  gate.resolve();
  await active;
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.queued, 0);
  assert.ok(snapshot.journal.length <= 4);
  assert.ok(snapshot.journal.every((event) => /^[a-f0-9]{64}$/.test(event.receiptSha256)));
  scheduler.close();
});

test('RepositoryIntelligenceScheduler rejects new work during emergency by default', async () => {
  const scheduler = new RepositoryIntelligenceScheduler({ governor: governor({ state: 'emergency', semanticIndexing: 'suspended' }), runners: { lexical: async () => ({}) } });
  await assert.rejects(
    scheduler.enqueue({ project: project('p1'), generation: 'g1', stages: ['lexical'] }),
    (error) => error?.code === 'REPOSITORY_INDEX_ADMISSION_BLOCKED',
  );
  scheduler.close();
});

test('RepositoryIntelligenceScheduler propagates branch context to repository stages', async () => {
  let observed = null;
  const scheduler = new RepositoryIntelligenceScheduler({
    governor: governor(),
    runners: { semantic: async (_project, options) => { observed = options.branchContext; return { ok: true }; } },
  });
  const branchContext = { branch: 'feature/semantic', headSha: 'a'.repeat(40), dirtyHash: 'clean' };
  await scheduler.enqueue({ project: project('p-branch'), generation: 'g1', stages: ['semantic'], branchContext });
  assert.deepEqual(observed, branchContext);
  scheduler.close();
});
