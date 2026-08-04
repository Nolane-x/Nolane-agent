import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionCompletionOrchestrator } from '../src/orchestration/mission-completion-orchestrator.mjs';

function fakeRunner() {
  const calls = [];
  return {
    calls,
    async plan(input) {
      const plan = await input.planner({ projectId: input.projectId, objective: input.objective });
      calls.push({ input, plan });
      return { id: input.missionId ?? 'mission-1', projectId: input.projectId, tasks: plan.tasks };
    },
  };
}

test('prepares a bounded completion workflow with independent repair tasks', async () => {
  const runner = fakeRunner();
  const orchestrator = new MissionCompletionOrchestrator({
    missionRunner: runner,
    capabilityChecker: async () => false,
  });
  const result = await orchestrator.prepare({ projectId: 'p1', principalId: 'u1', objective: 'Repair the project and verify it' });
  const ids = result.tasks.map((task) => task.metadata.completionPhase);
  assert.deepEqual(ids, ['architecture', 'repair-tests', 'repair-dependencies', 'resolve-conflicts', 'security-review', 'update-docs', 'local-pr-review']);
  const tests = result.tasks.find((task) => task.metadata.completionPhase === 'repair-tests');
  const deps = result.tasks.find((task) => task.metadata.completionPhase === 'repair-dependencies');
  assert.deepEqual(tests.dependencies, [result.tasks[0].id]);
  assert.deepEqual(deps.dependencies, [result.tasks[0].id]);
  assert.deepEqual(result.parallelGroups, [[tests.id, deps.id]]);
  assert.equal(result.commit.status, 'skipped');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('adds an integrator commit task only when capability is allowed', async () => {
  const runner = fakeRunner();
  const orchestrator = new MissionCompletionOrchestrator({ missionRunner: runner, capabilityChecker: async ({ capability }) => capability === 'git.commit' });
  const result = await orchestrator.prepare({ projectId: 'p1', principalId: 'u1', objective: 'Finish the project', allowCommit: true });
  const commit = result.tasks.at(-1);
  assert.equal(commit.metadata.completionPhase, 'commit');
  assert.equal(commit.role, 'integrator');
  assert.equal(result.commit.status, 'planned');
});

test('delegates local review, conflict resolution, and capability-gated commit to Git governance', async () => {
  const actions = [];
  const gitGovernance = {
    async collisionMap(input) { actions.push(['review', input]); return { status: 'pass', receiptSha256: 'a'.repeat(64) }; },
    async recordConflictResolution(input) { actions.push(['resolve', input]); return { status: 'pass', receiptSha256: 'b'.repeat(64) }; },
    async commit(input) { actions.push(['commit', input]); return { status: 'pass', receiptSha256: 'c'.repeat(64) }; },
  };
  const orchestrator = new MissionCompletionOrchestrator({ missionRunner: fakeRunner(), gitGovernance, capabilityChecker: async () => true });
  await orchestrator.reviewLocalPullRequest({ missionId: 'm1', principal: { subject: 'u1' } });
  await orchestrator.resolveConflict({ missionId: 'm1', leftTaskId: 'a', rightTaskId: 'b', principal: { subject: 'u1' }, expectedConflictReceiptSha256: 'd'.repeat(64), resolutionSummary: 'resolved', testReceipts: [{ status: 'pass' }] });
  await orchestrator.commitIfAllowed({ taskId: 't1', principal: { subject: 'u1' }, expectedHead: 'e'.repeat(40), paths: ['src/a.js'], message: 'fix: complete mission', testReceipts: [{ status: 'pass' }], residualRisks: [] });
  assert.deepEqual(actions.map(([name]) => name), ['review', 'resolve', 'commit']);
});
