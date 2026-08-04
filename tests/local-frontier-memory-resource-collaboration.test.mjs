import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  GovernedMemoryActionLearner,
  UserMemoryControl,
  RepositoryCausalMemory,
  ProcessTreeBudgetGovernor,
  ResourceLeaseManager,
  BrowserContextPool,
  DemandAwareResourceCoordinator,
  StartupRssBudget,
  ReviewerContextIsolation,
  GraphOwnershipResolver,
  CoalitionCommunicationGovernor,
  CoordinationMetrics,
} from '../src/frontier-completion/memory-resource-collaboration-runtime.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const verified = (id = 'outcome') => ({ outcomeId: id, verified: true, verificationReceiptSha256: sha(id) });

test('governed memory learner supports six actions only from verified trajectories', () => {
  const learner = new GovernedMemoryActionLearner();
  for (const action of ['ADD', 'UPDATE', 'DELETE', 'RETRIEVE', 'SUMMARIZE', 'NOOP']) learner.learn({ action, domain: 'repo', outcome: verified(action) });
  assert.deepEqual(learner.policy('repo').actions, ['ADD', 'DELETE', 'NOOP', 'RETRIEVE', 'SUMMARIZE', 'UPDATE']);
  assert.throws(() => learner.learn({ action: 'ADD', domain: 'repo', outcome: { verified: false } }), /verified/i);
  assert.throws(() => learner.learn({ action: 'EXECUTE', domain: 'repo', outcome: verified('bad') }), /unsupported/i);
});

test('user memory control exposes inspect edit invalidate archive and delete with receipts', () => {
  const control = new UserMemoryControl();
  const added = control.add({ id: 'm1', value: 'old', kind: 'skill' }, { actor: 'user' });
  assert.equal(control.inspect('m1').value, 'old');
  assert.equal(control.edit('m1', { value: 'new' }, { actor: 'user' }).value, 'new');
  assert.equal(control.invalidate('m1', { actor: 'user', reason: 'stale' }).state, 'invalid');
  assert.equal(control.archive('m1', { actor: 'user' }).state, 'archived');
  assert.equal(control.delete('m1', { actor: 'user' }).state, 'deleted');
  assert.equal(control.inspect('m1'), null);
  assert.match(added.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(control.auditLog().length, 5);
});

test('repository causal memory explains architecture decisions and invalidates on source or branch drift', () => {
  const memory = new RepositoryCausalMemory();
  memory.record({ id: 'adr-1', decision: 'Use SQLite', why: 'single-user local durability', alternatives: ['Postgres'], evidence: [{ path: 'src/store.mjs', sourceHash: sha('store') }], sourceHash: sha('repo'), branch: 'main' }, verified('adr'));
  assert.equal(memory.get('adr-1', { sourceHash: sha('repo'), branch: 'main' }).why, 'single-user local durability');
  assert.equal(memory.get('adr-1', { sourceHash: sha('changed'), branch: 'main' }), null);
  assert.equal(memory.get('adr-1', { sourceHash: sha('repo'), branch: 'feature' }), null);
});

test('process-tree governor enforces CPU RSS process and FD budgets without inventing unavailable counters', async () => {
  const governor = new ProcessTreeBudgetGovernor({ probe: async () => ({ available: true, platform: 'linux', cpuMs: 220, rssMb: 310, processes: 5, fileDescriptors: 90, receiptSha256: sha('probe') }) });
  const denied = await governor.enforce(123, { cpuMs: 200, rssMb: 256, processes: 4, fileDescriptors: 100 });
  assert.equal(denied.status, 'denied');
  assert.deepEqual(denied.violations.map((x) => x.metric), ['cpuMs', 'rssMb', 'processes']);
  const unavailable = new ProcessTreeBudgetGovernor({ probe: async () => ({ available: false, platform: 'win32', unavailable: ['fileDescriptors'], receiptSha256: sha('unavailable') }) });
  const report = await unavailable.enforce(1, { fileDescriptors: 10 });
  assert.equal(report.status, 'unavailable');
  assert.deepEqual(report.unavailable, ['fileDescriptors']);
});

test('resource leases unload by TTL and pressure while browser contexts reuse only after reset receipt', async () => {
  let unloaded = 0; let reset = 0; let created = 0;
  const leases = new ResourceLeaseManager({ clock: () => 1_000 });
  leases.register('embedding', { lastUsedAtMs: 0, ttlMs: 500, unload: async () => { unloaded += 1; } });
  const swept = await leases.sweep({ pressure: 'normal', nowMs: 1_000 });
  assert.deepEqual(swept.unloaded, ['embedding']);
  assert.equal(unloaded, 1);

  const pool = new BrowserContextPool({ factory: async () => ({ id: `ctx-${++created}` }), reset: async () => ({ reset: true, receiptSha256: sha(`reset-${++reset}`) }) });
  const a = await pool.acquire({ missionId: 'm1', journeyId: 'j1' });
  const b = await pool.acquire({ missionId: 'm1', journeyId: 'j2' });
  assert.equal(a.context.id, b.context.id);
  assert.match(b.resetReceiptSha256, /^[a-f0-9]{64}$/);
  const c = await pool.acquire({ missionId: 'm2', journeyId: 'j1' });
  assert.notEqual(c.context.id, a.context.id);
});

test('demand coordinator unloads embeddings before predicted browser/test demand and startup RSS has cold/warm budgets', async () => {
  let closed = 0;
  const coordinator = new DemandAwareResourceCoordinator();
  const decision = await coordinator.prepare({ predicted: ['browser', 'test'], embedding: { loaded: true, close: async () => { closed += 1; } } });
  assert.equal(decision.embeddingUnloaded, true);
  assert.equal(closed, 1);

  const budget = new StartupRssBudget({ coldMaxMb: 220, warmMaxMb: 180 });
  const report = budget.measure({ cold: [180, 205, 210], warm: [150, 160, 170] });
  assert.equal(report.status, 'pass');
  assert.equal(report.coldPeakMb, 210);
  assert.equal(report.warmPeakMb, 170);
});

test('reviewer context is independent and ownership derives from cited symbol path graph', () => {
  const isolation = new ReviewerContextIsolation();
  const session = isolation.create({ executor: { identity: 'exec-1', context: ['plan', 'private scratch'] }, reviewer: { identity: 'review-1', context: ['diff', 'tests'] } });
  assert.notEqual(session.executorContextSha256, session.reviewerContextSha256);
  assert.throws(() => isolation.create({ executor: { identity: 'same', context: ['x'] }, reviewer: { identity: 'same', context: ['y'] } }), /independent/i);

  const resolver = new GraphOwnershipResolver();
  const result = resolver.resolve({
    agents: [{ id: 'a', symbols: ['AccountService'] }, { id: 'b', symbols: ['BillingService'] }],
    graphEdges: [
      { symbol: 'AccountService', path: 'src/account.mjs', citation: { sourceHash: sha('a') } },
      { symbol: 'BillingService', path: 'src/billing.mjs', citation: { sourceHash: sha('b') } },
    ],
  });
  assert.equal(result.ownership['src/account.mjs'], 'a');
  assert.equal(result.ownership['src/billing.mjs'], 'b');
});

test('coalition communication broadcasts only the winning workspace within budget and coordination metrics are explicit', () => {
  const governor = new CoalitionCommunicationGovernor({ maxBytes: 128 });
  const result = governor.selectAndBroadcast([
    { coalitionId: 'c1', workspaceId: 'w1', utility: 0.7, message: 'candidate one' },
    { coalitionId: 'c2', workspaceId: 'w2', utility: 0.9, message: 'winner' },
  ]);
  assert.equal(result.broadcasts.length, 1);
  assert.equal(result.broadcasts[0].workspaceId, 'w2');
  assert.equal(result.bytes <= 128, true);

  const metrics = CoordinationMetrics.calculate({ decisions: [{ chosen: 0.7, optimal: 0.9 }, { chosen: 1, optimal: 1 }], coordinationMs: 20, totalMs: 100, conflicts: 2, assignments: 10, productiveParallelMs: 60, totalParallelMs: 80 });
  assert.equal(metrics.routingRegret, 0.1);
  assert.equal(metrics.coordinationOverhead, 0.2);
  assert.equal(metrics.conflictRate, 0.2);
  assert.equal(metrics.usefulParallelism, 0.75);
});
