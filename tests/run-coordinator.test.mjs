import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ActivityProjection } from '../src/orchestration/activity-projection.mjs';
import { RunCoordinator } from '../src/orchestration/run-coordinator.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-run-coordinator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'App', workspaceRoot: root });
  return { root, store, project };
}

test('RunCoordinator creates a durable run immediately then plans and autocompletes in the background', async (t) => {
  const { store, project } = await fixture(t);
  const planningGate = deferred();
  const autopilotGate = deferred();
  const missionRunner = {
    async plan({ missionId, projectId, objective, planner }) {
      await planningGate.promise;
      const plan = await planner({ projectId, objective });
      store.createTask({ projectId, missionId, title: plan.tasks[0].title, objective: plan.tasks[0].objective, role: plan.tasks[0].role, status: 'ready' });
      return store.updateMission(missionId, { status: 'running', metadata: { ...store.getMission(missionId).metadata, summary: plan.summary } });
    },
    pause(missionId) { return store.updateMission(missionId, { status: 'paused' }); },
    stop(missionId) { return store.updateMission(missionId, { status: 'stopped' }); },
    resume(missionId) { return store.updateMission(missionId, { status: 'running' }); },
  };
  const autopilot = {
    async run({ missionId }) {
      await autopilotGate.promise;
      store.updateMission(missionId, { status: 'completed' });
      return { missionId, status: 'completed', completedTasks: 1 };
    },
  };
  const plannerService = { async plan() { return { summary: 'Build and review', tasks: [{ id: 'build', title: 'Build feature', objective: 'Implement it', role: 'builder', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] }; } };
  const projection = new ActivityProjection({ store });
  const coordinator = new RunCoordinator({ store, missionRunner, plannerService, autopilot, activityProjection: projection });
  t.after(() => coordinator.close());

  const created = coordinator.createRun({ projectId: project.id, objective: 'Build the feature', autonomyProfile: 'workspace-autopilot' });
  assert.equal(created.mission.status, 'planning');
  assert.equal(created.messages[0].content, 'Build the feature');
  assert.equal(store.getAutonomyGrant(project.id).profile, 'workspace-autopilot');

  planningGate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.getMission(created.mission.id).status, 'running');
  autopilotGate.resolve();
  await coordinator.whenSettled(created.mission.id);

  const completed = coordinator.snapshot(created.mission.id);
  assert.equal(completed.mission.status, 'completed');
  assert.equal(completed.messages.at(-1).role, 'assistant');
  assert.match(completed.messages.at(-1).content, /hoàn thành/i);
  assert.equal(completed.activities.currentPhase, 'completed');
});

test('RunCoordinator persists follow-ups and controls pause, resume, stop, and retry', async (t) => {
  const { store, project } = await fixture(t);
  const blockers = [];
  const missionRunner = {
    async plan({ missionId, projectId }) {
      store.createTask({ projectId, missionId, title: 'Build', objective: 'Original objective', role: 'builder', status: 'ready' });
      return store.updateMission(missionId, { status: 'running' });
    },
    pause(missionId) { return store.updateMission(missionId, { status: 'paused' }); },
    stop(missionId) { return store.updateMission(missionId, { status: 'stopped' }); },
    resume(missionId) { return store.updateMission(missionId, { status: 'running' }); },
  };
  const autopilot = { async run({ missionId, signal }) { await new Promise((resolve, reject) => { blockers.push(resolve); signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }); }); return { missionId, status: 'completed' }; } };
  const plannerService = { async plan() { return { summary: 'Build', tasks: [{ id: 'build', title: 'Build', objective: 'Original objective', role: 'builder', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] }; } };
  const coordinator = new RunCoordinator({ store, missionRunner, plannerService, autopilot, activityProjection: new ActivityProjection({ store }) });
  t.after(() => coordinator.close());
  const created = coordinator.createRun({ projectId: project.id, objective: 'Original request' });
  await new Promise((resolve) => setImmediate(resolve));

  const message = coordinator.sendMessage(created.mission.id, 'Use the existing design system and keep mobile support.');
  assert.equal(message.role, 'user');
  assert.equal(store.getMission(created.mission.id).metadata.followUps.length, 1);
  assert.equal(store.listEvents({ afterSeq: 0 }).some((event) => event.type === 'run.follow-up.queued'), true);

  coordinator.pause(created.mission.id);
  assert.equal(store.getMission(created.mission.id).status, 'paused');
  coordinator.resume(created.mission.id);
  assert.equal(store.getMission(created.mission.id).status, 'running');
  coordinator.stop(created.mission.id);
  assert.equal(store.getMission(created.mission.id).status, 'stopped');

  const task = store.listTasks({ missionId: created.mission.id })[0];
  store.updateTask(task.id, { status: 'failed' });
  coordinator.retry(created.mission.id);
  assert.equal(store.getMission(created.mission.id).status, 'running');
  assert.equal(store.getTask(task.id).status, 'ready');
});

test('RunCoordinator exposes a human review and rolls back managed candidates after stopping active work', async (t) => {
  const { store, project } = await fixture(t);
  const mission = store.createMission({ projectId: project.id, objective: 'Change app', status: 'completed' });
  store.createTask({ id: 'builder-review', projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Change app', role: 'builder', status: 'done', metadata: { worktree: { path: '/managed/worktree', branch: 'forge/build' } } });
  const calls = [];
  const missionRunner = {
    async plan() {},
    pause(id) { return store.updateMission(id, { status: 'paused' }); },
    stop(id) { calls.push(['stop', id]); return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { return store.updateMission(id, { status: 'running' }); },
  };
  const reviewSummary = { async snapshot(id) { calls.push(['review', id]); return { missionId: id, canRollback: store.getMission(id).status !== 'rolled-back' }; } };
  const workspaceService = { async rollbackMission(id) { calls.push(['rollback', id]); store.updateMission(id, { status: 'rolled-back', metadata: { rolledBackAt: 'now' } }); return { missionId: id, removedWorktrees: 1 }; } };
  const coordinator = new RunCoordinator({
    store,
    missionRunner,
    plannerService: { async plan() { return { tasks: [] }; } },
    autopilot: { async run() { return {}; } },
    activityProjection: new ActivityProjection({ store }),
    reviewSummary,
    workspaceService,
  });
  t.after(() => coordinator.close());

  assert.equal((await coordinator.review(mission.id)).canRollback, true);
  const result = await coordinator.rollback(mission.id);
  assert.equal(result.mission.status, 'rolled-back');
  assert.equal(result.rollback.removedWorktrees, 1);
  assert.deepEqual(calls, [['review', mission.id], ['review', mission.id], ['rollback', mission.id], ['review', mission.id]]);
  assert.match(store.listMessages({ missionId: mission.id }).at(-1).content, /hoàn tác/i);
});

test('RunCoordinator rejects provider setup before creating a mission or autonomy grant', async (t) => {
  const { store, project } = await fixture(t);
  const coordinator = new RunCoordinator({
    store,
    missionRunner: { async plan() {}, pause() {}, stop() {}, resume() {} },
    plannerService: { async plan() { return { tasks: [] }; } },
    autopilot: { async run() { return {}; } },
    activityProjection: new ActivityProjection({ store }),
    providerReadiness: { readiness: () => ({ ready: false, readyProviders: [], providers: [{ id: 'codex', authenticated: false }] }) },
  });
  t.after(() => coordinator.close());
  assert.throws(
    () => coordinator.createRun({ projectId: project.id, objective: 'Do work' }),
    (error) => error.code === 'provider_setup_required' && error.statusCode === 409,
  );
  assert.equal(store.listMissions({ projectId: project.id }).length, 0);
  assert.equal(store.getAutonomyGrant(project.id), null);
});

test('RunCoordinator follow-up on a failed mission automatically recovers and relaunches it', async (t) => {
  const { store, project } = await fixture(t);
  const launches = [];
  const mission = store.createMission({ projectId: project.id, objective: 'Build feature', status: 'failed', metadata: { followUps: [], failureReason: 'Verification command failed' } });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Build feature', role: 'builder', status: 'review', metadata: { verificationFailure: { summary: 'npm test failed' } } });
  const missionRunner = {
    async plan() {},
    pause(id) { return store.updateMission(id, { status: 'paused' }); },
    stop(id) { return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { return store.updateMission(id, { status: 'running' }); },
  };
  const coordinator = new RunCoordinator({
    store,
    missionRunner,
    plannerService: { async plan() { return { tasks: [] }; } },
    autopilot: { async run({ missionId }) { launches.push(missionId); store.updateMission(missionId, { status: 'completed' }); return { missionId, status: 'completed', completedTasks: 1 }; } },
    activityProjection: new ActivityProjection({ store }),
  });
  t.after(() => coordinator.close());

  coordinator.sendMessage(mission.id, 'Tiếp tục và sửa lỗi kiểm thử.');
  await coordinator.whenSettled(mission.id);

  assert.deepEqual(launches, [mission.id]);
  assert.equal(store.getTask(task.id).status, 'ready');
  assert.equal(store.getMission(mission.id).status, 'completed');
  assert.equal(store.getMission(mission.id).metadata.failureReason, null);
});

test('RunCoordinator retry recovers tasks stuck in review after verification failure', async (t) => {
  const { store, project } = await fixture(t);
  const mission = store.createMission({ projectId: project.id, objective: 'Build feature', status: 'failed', metadata: { failureStage: 'verification' } });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Build feature', role: 'builder', status: 'review', metadata: { verificationFailure: { summary: 'diff check failed' } } });
  const coordinator = new RunCoordinator({
    store,
    missionRunner: { async plan() {}, pause() {}, stop() {}, resume(id) { return store.updateMission(id, { status: 'running' }); } },
    plannerService: { async plan() { return { tasks: [] }; } },
    autopilot: { async run({ missionId }) { store.updateMission(missionId, { status: 'completed' }); return { missionId, status: 'completed', completedTasks: 1 }; } },
    activityProjection: new ActivityProjection({ store }),
  });
  t.after(() => coordinator.close());

  coordinator.retry(mission.id);
  assert.equal(store.getTask(task.id).status, 'ready');
  await coordinator.whenSettled(mission.id);
  assert.equal(store.getMission(mission.id).status, 'completed');
});

test('RunCoordinator exposes a structured failure with the real stage and safe reason', async (t) => {
  const { store, project } = await fixture(t);
  const missionRunner = {
    async plan({ missionId, projectId }) {
      store.createTask({ id: 'task-check', projectId, missionId, title: 'Run tests', objective: 'Verify changes', role: 'builder', status: 'ready' });
      return store.updateMission(missionId, { status: 'running' });
    },
    pause(id) { return store.updateMission(id, { status: 'paused' }); },
    stop(id) { return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { return store.updateMission(id, { status: 'running' }); },
  };
  const error = Object.assign(new Error('Verification command 1 failed with exit code 1.'), { code: 'VERIFICATION_FAILED', taskId: 'task-check' });
  const coordinator = new RunCoordinator({
    store,
    missionRunner,
    plannerService: { async plan() { return { summary: 'Verify', tasks: [{ id: 'check', title: 'Run tests', objective: 'Verify', role: 'builder', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] }; } },
    autopilot: { async run() { throw error; } },
    activityProjection: new ActivityProjection({ store }),
  });
  t.after(() => coordinator.close());

  const created = coordinator.createRun({ projectId: project.id, objective: 'Verify the app' });
  await new Promise((resolve) => setImmediate(resolve));
  await coordinator.whenSettled(created.mission.id);
  const snapshot = coordinator.snapshot(created.mission.id);

  assert.equal(snapshot.mission.status, 'failed');
  assert.equal(snapshot.failure.stage, 'verification');
  assert.equal(snapshot.failure.taskId, 'task-check');
  assert.match(snapshot.failure.reason, /exit code 1/i);
  assert.match(snapshot.messages.at(-1).content, /kiểm chứng/i);
  assert.doesNotMatch(snapshot.messages.at(-1).content, /chưa thể hoàn thành nhiệm vụ\.$/i);
});

test('RunCoordinator propagates bounded ForgeOS capabilities and one-time remote sandbox approval to planned tasks', async (t) => {
  const { store, project } = await fixture(t);
  let capturedPlan;
  const missionRunner = {
    async plan({ missionId, projectId, objective, planner }) {
      capturedPlan = await planner({ projectId, objective });
      return store.updateMission(missionId, { status: 'stopped' });
    },
    pause(id) { return store.updateMission(id, { status: 'paused' }); },
    stop(id) { return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { return store.updateMission(id, { status: 'running' }); },
  };
  const coordinator = new RunCoordinator({
    store,
    missionRunner,
    plannerService: { async plan() { return { summary: 'Plan', tasks: [{ id: 'inspect', title: 'Inspect', objective: 'Inspect safely', role: 'scout', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] }; } },
    autopilot: { async run() { throw new Error('must not run'); } },
    activityProjection: new ActivityProjection({ store }),
  });
  t.after(() => coordinator.close());
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const created = coordinator.createRun({
    projectId: project.id,
    objective: 'Inspect with ForgeOS',
    forgeOsCapabilities: ['remote-sandbox.run', 'remote-sandbox.run', 'unknown'],
    remoteSandboxApproval: { id: 'approval-123', expiresAt },
  });
  await new Promise((resolve) => setImmediate(resolve));
  await coordinator.whenSettled(created.mission.id);
  assert.deepEqual(capturedPlan.tasks[0].metadata.forgeOsCapabilities, ['remote-sandbox.run']);
  assert.deepEqual(capturedPlan.tasks[0].metadata.remoteSandboxApproval, { id: 'approval-123', expiresAt });
  assert.equal(capturedPlan.tasks[0].metadata.dynamicToolDiscovery, true);
});

test('RunCoordinator archives visible conversation history after completion without blocking durable mission state', async (t) => {
  const { store, project } = await fixture(t);
  const archived = [];
  const contextHistoryArchive = {
    async archiveConversation(input) {
      archived.push({ ...input, messages: input.messages.map((message) => ({ id: message.id, role: message.role, content: message.content })) });
      return { created: true, itemCount: input.messages.length };
    },
  };
  const missionRunner = {
    async plan({ missionId, projectId }) {
      store.createTask({ projectId, missionId, title: 'Build', objective: 'Build', role: 'builder', status: 'ready' });
      return store.updateMission(missionId, { status: 'running' });
    },
    pause(id) { return store.updateMission(id, { status: 'paused' }); },
    stop(id) { return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { return store.updateMission(id, { status: 'running' }); },
  };
  const coordinator = new RunCoordinator({
    store,
    missionRunner,
    plannerService: { async plan() { return { tasks: [] }; } },
    autopilot: { async run({ missionId }) { store.updateMission(missionId, { status: 'completed' }); return { completedTasks: 1 }; } },
    activityProjection: new ActivityProjection({ store }),
    contextHistoryArchive,
  });
  t.after(() => coordinator.close());

  const created = coordinator.createRun({ projectId: project.id, objective: 'Archive this conversation' });
  await coordinator.whenSettled(created.mission.id);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].projectId, project.id);
  assert.equal(archived[0].missionId, created.mission.id);
  assert.deepEqual(archived[0].messages.map((message) => message.role), ['user', 'assistant']);
});
