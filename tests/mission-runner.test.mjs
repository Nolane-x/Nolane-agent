import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { TaskScheduler } from '../src/orchestration/task-graph.mjs';
import { MissionRunner } from '../src/orchestration/mission-runner.mjs';
import { InterruptManager } from '../src/orchestration/interrupts.mjs';

async function fixture(t, agentLoop = null) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-mission-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const scheduler = new TaskScheduler({ store });
  const loop = agentLoop ?? { async run(task) { return { runId: `run-${task.id}`, state: 'awaiting-verification', output: 'candidate', receipts: [] }; } };
  const forge = { async recordEvidence(_projectId, input) { return { id: 'forge-evidence', ...input, status: 'unverified' }; } };
  const interrupts = new InterruptManager({ store });
  return { root, store, project, interrupts, runner: new MissionRunner({ store, scheduler, agentLoop: loop, forge, interrupts }) };
}

const plan = {
  summary: 'Implement and independently review one feature.',
  tasks: [
    { id: 'scout', title: 'Inspect', objective: 'Inspect current code.', role: 'scout', dependencies: [], allowedPaths: ['docs/research/**'] },
    { id: 'builder', title: 'Build', objective: 'Implement feature.', role: 'builder', dependencies: ['scout'], allowedPaths: ['src/**'] },
    { id: 'reviewer', title: 'Review', objective: 'Review and verify feature.', role: 'reviewer', dependencies: ['builder'], allowedPaths: ['tests/**'] },
  ],
};

test('MissionRunner validates planner JSON, roles, DAG, and independent review', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.runner.plan({ projectId: f.project.id, objective: 'bad', planner: async () => ({ tasks: [{ id: 'build', role: 'builder', dependencies: [], allowedPaths: ['src/**'] }] }) }), /reviewer/i);
  await assert.rejects(() => f.runner.plan({ projectId: f.project.id, objective: 'bad json', planner: async () => 'not json' }), /planner/i);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  assert.equal(mission.tasks.length, 3);
  assert.deepEqual(mission.tasks.map((task) => task.role), ['scout', 'builder', 'reviewer']);
  assert.equal(mission.tasks[2].dependencies[0], mission.tasks[1].id);
  assert.equal(mission.tasks[1].metadata.taskKind, 'builder');
  assert.equal(mission.tasks[1].metadata.selfFix.enabled, true);
  assert.equal(mission.tasks[1].metadata.testMatrix.requireFull, true);
  assert.equal(mission.tasks[1].metadata.testMatrix.changedPaths[0], 'src/**');
});

test('MissionRunner carries explicitly selected skill receipts into every planned task', async (t) => {
  const f = await fixture(t);
  const selectedSkills = [{
    id: 'forgeos:v2:repository-review', source: 'forge-os', catalog: 'v2', title: 'Repository review',
    contentSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64), provenanceStatus: 'verified-source-snapshot',
  }];
  const mission = await f.runner.plan({
    projectId: f.project.id,
    objective: 'Review the repository safely',
    planner: async () => plan,
    planningMetadata: { selectedSkills },
  });

  assert.deepEqual(mission.metadata.selectedSkills, selectedSkills);
  assert.ok(mission.tasks.every((task) => JSON.stringify(task.metadata.selectedSkills) === JSON.stringify(selectedSkills)));
});

test('MissionRunner preserves an explicit provider, model, and effort from planning through task execution', async (t) => {
  let request;
  const f = await fixture(t, { async run(_task, input) { request = input; return { runId: 'run-explicit-model', state: 'awaiting-verification', output: 'candidate', receipts: [] }; } });
  const mission = await f.runner.plan({
    projectId: f.project.id,
    objective: 'Use the selected Codex deployment',
    planner: async () => plan,
    planningMetadata: { planningProviderId: 'codex-app-server', planningModelId: 'gpt-5.6-codex', planningEffort: 'high' },
  });

  await f.runner.runNext({ missionId: mission.id, workerId: 'worker-explicit-model', providerId: 'auto' });
  assert.equal(request.providerId, 'codex-app-server');
  assert.equal(request.model, 'gpt-5.6-codex');
  assert.equal(request.effort, 'high');
});

test('MissionRunner runs leased work and blocks completion without passing commit-bound evidence', async (t) => {
  const f = await fixture(t);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const first = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-scout', providerId: 'fake' });
  assert.equal(first.task.status, 'review');
  assert.equal(first.task.metadata.handoff.schema, 'forge.task.handoff.v1');
  assert.match(first.task.metadata.handoff.handoffSha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => f.runner.verify({ taskId: first.task.id, workerId: 'worker-scout', fencingToken: first.lease.fencingToken, evidence: [{ kind: 'test', status: 'fail' }] }), /passing evidence/i);
  const passed = await f.runner.verify({
    taskId: first.task.id,
    workerId: 'worker-scout',
    fencingToken: first.lease.fencingToken,
    evidence: [{ kind: 'test', status: 'pass', commit: 'abc1234', artifactSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64), summary: 'Focused tests passed.' }],
  });
  assert.equal(passed.task.status, 'done');
  assert.equal(f.store.listEvidence({ taskId: first.task.id })[0].status, 'pass');
  const second = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-builder', providerId: 'fake' });
  assert.equal(second.task.role, 'builder');
});

test('MissionRunner emergency stop cancels active runs and resume restores mission scheduling', async (t) => {
  const slowLoop = { async run(_task, { signal }) { await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 10_000); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Run cancelled')); }, { once: true }); }); } };
  const f = await fixture(t, slowLoop);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const running = f.runner.runNext({ missionId: mission.id, workerId: 'worker-a', providerId: 'fake' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const stopped = f.runner.stop(mission.id, 'operator emergency stop');
  assert.equal(stopped.status, 'stopped');
  await assert.rejects(() => running, /cancelled/i);
  const resumed = f.runner.resume(mission.id);
  assert.equal(resumed.status, 'running');
});


test('MissionRunner durably blocks and idempotently resumes a task through an interrupt', async (t) => {
  const f = await fixture(t);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const task = mission.tasks[0];
  const interrupt = f.runner.interruptTask({ taskId: task.id, kind: 'operator-input', prompt: { question: 'Which API?' }, idempotencyKey: 'task-pause-1' });
  assert.equal(f.store.getTask(task.id).status, 'blocked');
  assert.equal(interrupt.taskId, task.id);
  const resumed = f.runner.resumeInterrupt({ interruptId: interrupt.id, resumeToken: interrupt.resumeToken, response: { answer: 'official' }, idempotencyKey: 'task-resume-1' });
  assert.equal(resumed.task.status, 'ready');
  assert.deepEqual(resumed.task.metadata.interruptResponses[interrupt.id], { answer: 'official' });
  const duplicate = f.runner.resumeInterrupt({ interruptId: interrupt.id, resumeToken: interrupt.resumeToken, response: { answer: 'ignored' }, idempotencyKey: 'task-resume-1' });
  assert.equal(duplicate.interrupt.duplicate, true);
  assert.deepEqual(duplicate.task.metadata.interruptResponses[interrupt.id], { answer: 'official' });
});

test('MissionRunner prepares the task workspace before entering the agent loop', async (t) => {
  const seen = [];
  const loop = { async run(task) { seen.push(task.metadata.executionWorkspace); return { runId: `run-${task.id}`, state: 'awaiting-verification', output: 'candidate', receipts: [] }; } };
  const f = await fixture(t, loop);
  const workspaceService = {
    async prepare(task) {
      return f.store.updateTask(task.id, { metadata: { ...task.metadata, executionWorkspace: path.join(f.root, 'prepared') } });
    },
  };
  f.runner.workspaceService = workspaceService;
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const result = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-scout', providerId: 'fake' });
  assert.equal(seen[0], path.join(f.root, 'prepared'));
  assert.equal(result.task.metadata.executionWorkspace, path.join(f.root, 'prepared'));
});

test('MissionRunner records verified outcomes as quarantined observed memory', async (t) => {
  const f = await fixture(t);
  const observations = [];
  f.runner.memoryService = { async observe(input) { observations.push(input); return { id: 'memory-1', status: 'observed' }; } };
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const run = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-scout', providerId: 'fake' });
  const verified = await f.runner.verify({
    taskId: run.task.id,
    workerId: 'worker-scout',
    fencingToken: run.lease.fencingToken,
    evidence: [{ kind: 'test', status: 'pass', commit: 'abc1234', artifactSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64), summary: 'Focused tests passed.' }],
  });
  assert.equal(observations.length, 1);
  assert.equal(observations[0].projectId, f.project.id);
  assert.match(observations[0].content, /Focused tests passed/);
  assert.equal(verified.task.metadata.memoryObservationId, 'memory-1');
});

test('MissionRunner applies queued user follow-ups at the next safe task checkpoint', async (t) => {
  const seen = [];
  const loop = { async run(task) { seen.push(task); return { runId: `run-${task.id}`, state: 'awaiting-verification', output: 'candidate', receipts: [] }; } };
  const f = await fixture(t, loop);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  f.store.updateMission(mission.id, { metadata: { ...f.store.getMission(mission.id).metadata, followUps: [{ id: 'message_1', content: 'Keep the public API backward compatible.', createdAt: new Date().toISOString() }] } });
  await f.runner.runNext({ missionId: mission.id, workerId: 'worker-follow-up', providerId: 'fake' });
  assert.match(seen[0].objective, /backward compatible/i);
  assert.deepEqual(seen[0].metadata.appliedFollowUpIds, ['message_1']);
});

test('MissionRunner propagates durable goal discovery and browser permissions into every planned task', async (t) => {
  const f = await fixture(t);
  const mission = f.store.createMission({
    projectId: f.project.id,
    objective: 'Build feature',
    status: 'planning',
    metadata: {
      goalId: 'goal_1',
      goalAutoApplyPlanPatches: true,
      browserAllowedActions: ['open', 'snapshot', 'click'],
      mcpAllowedTools: ['docs.search'],
    },
  });
  const planned = await f.runner.plan({ missionId: mission.id, projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  for (const task of planned.tasks) {
    assert.equal(task.metadata.goalId, 'goal_1');
    assert.equal(task.metadata.goalAutoApplyPlanPatches, true);
    assert.deepEqual(task.metadata.browserAllowedActions, ['open', 'snapshot', 'click']);
    assert.deepEqual(task.metadata.mcpAllowedTools, ['docs.search']);
  }
});

test('MissionRunner captures a pre-edit test baseline for self-fix-enabled work', async (t) => {
  const seen = [];
  const loop = { async run(task) { seen.push(task); return { runId: `run-${task.id}`, state: 'awaiting-verification', output: 'candidate', receipts: [] }; } };
  const f = await fixture(t, loop);
  f.runner.baselineProvider = async (task) => ({ schema: 'forge.test-baseline.v1', scope: 'file', output: 'src/a.mjs:1:1 error OLD: existing', status: 'fail', receiptSha256: 'a'.repeat(64), taskId: task.id });
  const customPlan = structuredClone(plan);
  customPlan.tasks[0].metadata = { selfFix: { enabled: true }, testMatrix: { relatedTests: ['tests/a.test.mjs'], requireFull: true } };
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => customPlan });

  const result = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-scout', providerId: 'fake' });

  assert.equal(seen[0].metadata.testBaseline.scope, 'file');
  assert.match(seen[0].metadata.testBaseline.output, /OLD/);
  assert.equal(result.task.metadata.testBaseline.receiptSha256, 'a'.repeat(64));
});

test('MissionRunner performs a bounded verification repair without releasing the task lease', async (t) => {
  const seen = [];
  const loop = {
    async run(task) {
      seen.push(task);
      return { runId: `run-${seen.length}`, state: 'awaiting-verification', output: seen.length === 1 ? 'candidate' : 'repair candidate', receipts: [{ receiptSha256: 'b'.repeat(64) }] };
    },
  };
  const f = await fixture(t, loop);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const run = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-scout', providerId: 'fake' });
  const repair = await f.runner.repairVerification({
    taskId: run.task.id,
    workerId: 'worker-scout',
    fencingToken: run.lease.fencingToken,
    providerId: 'fake',
    repairRequest: {
      attempt: 1,
      requiredStrategyChange: false,
      previousStrategyId: null,
      delta: { newDiagnostics: [{ path: 'src/new.mjs', line: 2, column: 3, code: 'NEW', message: 'regression' }], persistingDiagnostics: [{ code: 'OLD' }] },
      failingTestReceiptSha256: 'c'.repeat(64),
      stateSha256: 'd'.repeat(64),
    },
  });

  assert.equal(repair.status, 'applied');
  assert.equal(repair.strategyId, 'targeted-verification-repair');
  assert.match(repair.receiptSha256, /^[a-f0-9]{64}$/);
  assert.match(seen[1].objective, /NEW/);
  assert.match(seen[1].objective, /do not expand scope/i);
  assert.equal(repair.task.status, 'review');
  assert.equal(repair.task.leaseOwner, 'worker-scout');
  assert.equal(repair.task.metadata.verificationRepairHistory.length, 1);
});


test('MissionRunner records verified provider outcomes without allowing telemetry failure to invalidate evidence', async (t) => {
  const f = await fixture(t);
  const outcomes = [];
  f.runner.outcomeService = { recordVerification(input) { outcomes.push(input); return { recorded: true }; } };
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build feature', planner: async () => plan });
  const run = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-scout', providerId: 'fake' });
  await f.runner.verify({
    taskId: run.task.id,
    workerId: 'worker-scout',
    fencingToken: run.lease.fencingToken,
    evidence: [{ kind: 'test', status: 'pass', commit: 'abc1234', artifactSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64), summary: 'Passed.' }],
  });
  assert.deepEqual(outcomes[0], { taskId: run.task.id, verified: true, evidenceReceiptSha256: 'b'.repeat(64), costUsd: 0, latencyMs: 0 });

  const f2 = await fixture(t);
  f2.runner.outcomeService = { recordVerification() { throw new Error('metrics unavailable'); } };
  const mission2 = await f2.runner.plan({ projectId: f2.project.id, objective: 'Build feature', planner: async () => plan });
  const run2 = await f2.runner.runNext({ missionId: mission2.id, workerId: 'worker-scout', providerId: 'fake' });
  const verified = await f2.runner.verify({ taskId: run2.task.id, workerId: 'worker-scout', fencingToken: run2.lease.fencingToken, evidence: [{ kind: 'test', status: 'pass', commit: 'abc1234', artifactSha256: 'a'.repeat(64), receiptSha256: 'c'.repeat(64), summary: 'Passed.' }] });
  assert.equal(verified.task.status, 'done');
});
