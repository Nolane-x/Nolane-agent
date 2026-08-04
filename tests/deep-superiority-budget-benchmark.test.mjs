import test from 'node:test';
import assert from 'node:assert/strict';
import { ProofBudgetScheduler } from '../src/superiority/deep/proof-budget-scheduler.mjs';
import { ComparativeBenchmarkLab } from '../src/superiority/deep/comparative-benchmark-lab.mjs';

const H = (c) => c.repeat(64);

test('proof budget scheduler reserves verifier capacity, respects dependencies and reports impossible missions', () => {
  const scheduler = new ProofBudgetScheduler();
  const schedule = scheduler.schedule({
    missionId: 'mission-1', budget: { tokens: 1000, elapsedMs: 1000, costUsd: 1 }, verificationReserveRatio: 0.3,
    tasks: [
      { taskId: 'build', dependencies: [], risk: 0.4, proofRequired: false, priority: 5, estimated: { tokens: 400, elapsedMs: 300, costUsd: 0.3 } },
      { taskId: 'verify', dependencies: ['build'], risk: 0.9, proofRequired: true, priority: 10, estimated: { tokens: 250, elapsedMs: 300, costUsd: 0.2 } },
      { taskId: 'docs', dependencies: ['build'], risk: 0.1, proofRequired: false, priority: 1, estimated: { tokens: 100, elapsedMs: 100, costUsd: 0.1 } },
    ],
  });
  assert.equal(schedule.status, 'scheduled');
  assert.deepEqual(schedule.executionOrder, ['build', 'verify', 'docs']);
  assert.ok(schedule.allocations.find((item) => item.taskId === 'verify').reservedProofCapacity);
  assert.equal(schedule.authorization.proofStarvationAllowed, false);

  const blocked = scheduler.schedule({ missionId: 'mission-2', budget: { tokens: 100, elapsedMs: 100, costUsd: 0.1 }, tasks: [{ taskId: 'verify', proofRequired: true, risk: 1, dependencies: [], estimated: { tokens: 200, elapsedMs: 200, costUsd: 0.2 } }] });
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.blockers.includes('budget-insufficient'));
});

test('comparative benchmark opens superiority only for matched independent paired evidence', () => {
  const lab = new ComparativeBenchmarkLab({ clock: () => 500 });
  lab.createStudy({ studyId: 'study-1', competitor: 'NolaneNative Agent', baselineVersion: '0.18.2', minPairs: 20, alpha: 0.05, minMeanEffect: 0.05 });
  const environment = { machine: 'same-machine', model: 'same-model', tokenBudget: 10000, permissions: ['repo'], tools: ['shell'] };
  const tasksN = Array.from({ length: 24 }, (_, index) => ({ taskId: `t${index}`, score: 1, passed: true, tokens: 100, elapsedMs: 100, costUsd: 0.01 }));
  const tasksH = Array.from({ length: 24 }, (_, index) => ({ taskId: `t${index}`, score: index < 22 ? 0.7 : 1, passed: index >= 22, tokens: 100, elapsedMs: 100, costUsd: 0.01 }));
  lab.ingestRun('study-1', { system: 'nolane', artifactId: 'n1', real: true, independentProducer: false, artifactSha256: H('a'), environment, tasks: tasksN });
  lab.ingestRun('study-1', { system: 'nolane_native', artifactId: 'h1', real: true, independentProducer: true, artifactSha256: H('b'), environment, tasks: tasksH });
  const result = lab.evaluate('study-1');
  assert.equal(result.pairedTasks, 24);
  assert.equal(result.environmentMatched, true);
  assert.equal(result.comparativeSuperiorityClaimAllowed, true);
  assert.ok(result.statistics.pValue < 0.05);

  lab.createStudy({ studyId: 'study-2', competitor: 'NolaneNative Agent', baselineVersion: '0.18.2', minPairs: 2 });
  lab.ingestRun('study-2', { system: 'nolane', artifactId: 'n2', real: true, independentProducer: false, artifactSha256: H('c'), environment, tasks: tasksN.slice(0, 2) });
  lab.ingestRun('study-2', { system: 'nolane_native', artifactId: 'h2', real: true, independentProducer: false, artifactSha256: H('d'), environment: { ...environment, model: 'different' }, tasks: tasksH.slice(0, 2) });
  const blocked = lab.evaluate('study-2');
  assert.equal(blocked.comparativeSuperiorityClaimAllowed, false);
  assert.ok(blocked.blockers.includes('environment-mismatch'));
  assert.ok(blocked.blockers.includes('competitor-artifact-not-independent'));
});
