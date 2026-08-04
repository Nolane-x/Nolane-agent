import assert from 'node:assert/strict';
import test from 'node:test';

import { SubagentOrchestrator } from '../src/agents/subagent-orchestrator.mjs';

const profile = Object.freeze({
  id: 'worker', description: 'worker', prompt: '', tools: ['fs.read'], exclusiveTools: [], mcpServers: [], skills: [], capabilities: [],
  maxTurns: 8, budgetTokens: 8_000, allowChildAgents: false, sandboxProfile: 'workspace',
});

const parentTask = Object.freeze({
  id: 'parent', projectId: 'p1', allowedTools: ['fs.read'], allowedMcpServers: [], allowedSkills: [], permissions: ['agent.create'], maxTurns: 8, budgetTokens: 8_000,
});

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

test('runAdaptiveGraph applies bounded add, revise, and revoke mutations only to unfinished work', async () => {
  const ran = [];
  let reconciliations = 0;
  const orchestrator = new SubagentOrchestrator({
    profiles: [profile],
    maxConcurrency: 1,
    runner: async (child) => { ran.push([child.jobId, child.objective]); return { summary: child.objective, receipts: [] }; },
  });
  const result = await orchestrator.runAdaptiveGraph({
    parentTask,
    jobs: [
      { id: 'seed', profileId: 'worker', objective: 'seed' },
      { id: 'later', profileId: 'worker', objective: 'old objective', dependencies: ['seed'] },
      { id: 'remove', profileId: 'worker', objective: 'remove me', dependencies: ['seed'] },
    ],
    reconcile: async ({ revision }) => {
      reconciliations += 1;
      if (revision !== 1) return {};
      return {
        add: [{ id: 'added', profileId: 'worker', objective: 'new work', dependencies: ['seed'] }],
        revise: [{ id: 'later', objective: 'revised objective', ownedSymbols: ['Auth.login'] }],
        revoke: ['remove'],
        reason: 'first-wave evidence changed the plan',
      };
    },
  });
  assert.deepEqual(ran, [['seed', 'seed'], ['later', 'revised objective'], ['added', 'new work']]);
  assert.equal(reconciliations >= 2, true);
  assert.equal(result.completed.map((item) => item.jobId).sort().join(','), 'added,later,seed');
  assert.deepEqual(result.stopped, [{ jobId: 'remove', reason: 'revoked', detail: 'first-wave evidence changed the plan' }]);
  assert.ok(result.mutations.some((entry) => entry.type === 'subagent.graph.jobs-added'));
  assert.ok(result.mutations.some((entry) => entry.type === 'subagent.graph.jobs-revised'));
  assert.ok(result.mutations.some((entry) => entry.type === 'subagent.graph.jobs-revoked'));
  assert.ok(result.mutations.every((entry) => /^[a-f0-9]{64}$/.test(entry.receiptSha256)));
});

test('runAdaptiveGraph serializes path and symbol ownership collisions while using governor-bounded concurrency', async () => {
  let active = 0;
  let peak = 0;
  let conflictingActive = 0;
  let collisionObserved = false;
  const events = [];
  const governor = { snapshot: () => ({ state: 'pressure', policy: { maxActiveAgents: 2 } }) };
  const orchestrator = new SubagentOrchestrator({
    profiles: [profile], governor, maxConcurrency: 4, eventSink: (event) => events.push(event),
    runner: async (child) => {
      active += 1; peak = Math.max(peak, active);
      if (['a', 'b'].includes(child.jobId)) { conflictingActive += 1; if (conflictingActive > 1) collisionObserved = true; }
      await delay(30);
      if (['a', 'b'].includes(child.jobId)) conflictingActive -= 1;
      active -= 1;
      return { summary: child.jobId, receipts: [] };
    },
  });
  const result = await orchestrator.runAdaptiveGraph({ parentTask, jobs: [
    { id: 'a', profileId: 'worker', objective: 'a', ownedPaths: ['src/auth.mjs'], ownedSymbols: ['Auth.login'] },
    { id: 'b', profileId: 'worker', objective: 'b', ownedPaths: ['src/auth.mjs'] },
    { id: 'c', profileId: 'worker', objective: 'c', ownedPaths: ['src/billing.mjs'] },
  ] });
  assert.equal(result.completed.length, 3);
  assert.equal(peak, 2);
  assert.equal(collisionObserved, false);
  assert.ok(events.some((entry) => entry.type === 'subagent.graph.ownership-serialized'));
});

test('runAdaptiveGraph stops low-confidence or low-information jobs with explicit receipt-backed reasons', async () => {
  const ran = [];
  const orchestrator = new SubagentOrchestrator({ profiles: [profile], runner: async (child) => { ran.push(child.jobId); return { summary: child.jobId, receipts: [] }; } });
  const result = await orchestrator.runAdaptiveGraph({
    parentTask,
    policy: { minConfidence: 0.6, minInformationGain: 0.2 },
    jobs: [
      { id: 'uncertain', profileId: 'worker', objective: 'uncertain', confidence: 0.2, expectedInformationGain: 0.8 },
      { id: 'low-value', profileId: 'worker', objective: 'low value', confidence: 0.9, expectedInformationGain: 0.05 },
      { id: 'good', profileId: 'worker', objective: 'good', confidence: 0.9, expectedInformationGain: 0.8 },
    ],
  });
  assert.deepEqual(ran, ['good']);
  assert.deepEqual(result.stopped.map((item) => [item.jobId, item.reason]), [['uncertain', 'confidence-below-threshold'], ['low-value', 'information-gain-below-threshold']]);
  assert.ok(result.mutations.filter((entry) => entry.type === 'subagent.graph.job-stopped').every((entry) => /^[a-f0-9]{64}$/.test(entry.receiptSha256)));
});

test('runAdaptiveGraph retries within maxAttempts and fails closed when attempts are exhausted', async () => {
  const attempts = new Map();
  const orchestrator = new SubagentOrchestrator({ profiles: [profile], runner: async (child) => {
    const count = (attempts.get(child.jobId) ?? 0) + 1; attempts.set(child.jobId, count);
    if (child.jobId === 'retry' && count === 1) throw Object.assign(new Error('transient'), { code: 'TRANSIENT' });
    if (child.jobId === 'fail') throw Object.assign(new Error('permanent'), { code: 'PERMANENT' });
    return { summary: child.jobId, receipts: [] };
  } });
  const successful = await orchestrator.runAdaptiveGraph({ parentTask, jobs: [{ id: 'retry', profileId: 'worker', objective: 'retry', maxAttempts: 2 }] });
  assert.equal(successful.completed.length, 1);
  assert.equal(attempts.get('retry'), 2);
  await assert.rejects(
    orchestrator.runAdaptiveGraph({ parentTask, jobs: [{ id: 'fail', profileId: 'worker', objective: 'fail', maxAttempts: 2 }] }),
    (error) => error?.code === 'SUBAGENT_JOB_ATTEMPTS_EXHAUSTED' && /fail/.test(error.message),
  );
  assert.equal(attempts.get('fail'), 2);
});

test('runAdaptiveGraph rejects cycles and reconciler mutations that alter completed jobs or exceed bounds', async () => {
  const orchestrator = new SubagentOrchestrator({ profiles: [profile], maxConcurrency: 1, runner: async (child) => ({ summary: child.jobId, receipts: [] }) });
  await assert.rejects(orchestrator.runAdaptiveGraph({ parentTask, jobs: [
    { id: 'a', profileId: 'worker', objective: 'a', dependencies: ['b'] },
    { id: 'b', profileId: 'worker', objective: 'b', dependencies: ['a'] },
  ] }), (error) => error?.code === 'SUBAGENT_GRAPH_CYCLE');
  await assert.rejects(orchestrator.runAdaptiveGraph({
    parentTask,
    jobs: [{ id: 'done', profileId: 'worker', objective: 'done' }],
    reconcile: async () => ({ revise: [{ id: 'done', objective: 'illegal revision' }] }),
  }), (error) => error?.code === 'SUBAGENT_GRAPH_MUTATION_DENIED');
  await assert.rejects(orchestrator.runAdaptiveGraph({
    parentTask,
    jobs: [{ id: 'seed', profileId: 'worker', objective: 'seed' }],
    policy: { maxJobs: 1 },
    reconcile: async () => ({ add: [{ id: 'extra', profileId: 'worker', objective: 'extra' }] }),
  }), (error) => error?.code === 'SUBAGENT_GRAPH_LIMIT');
});
