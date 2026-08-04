import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ActivityProjection } from '../src/orchestration/activity-projection.mjs';
import { createEvent } from '../src/protocol/events.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-studio-activity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'App', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build a login page', status: 'running' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Implement login', objective: 'Add login form', status: 'ready', role: 'builder' });
  return { store, project, mission, task };
}

test('ActivityProjection converts durable technical events into a human task narrative', async (t) => {
  const { store, project, mission, task } = await fixture(t);
  const refs = { projectId: project.id, missionId: mission.id, taskId: task.id, runId: 'run_1' };
  for (const event of [
    createEvent('mission.planned', { summary: 'Implement and verify login', taskCount: 2 }, refs),
    createEvent('mission.task.started', { role: 'builder', executionWorkspace: '/private/worktree' }, refs),
    createEvent('agent.repository.context-selected', { selected: [{ path: 'src/auth.mjs' }, { path: 'tests/auth.test.mjs' }] }, refs),
    createEvent('agent.model.requested', { turn: 1, providerId: 'codex' }, refs),
    createEvent('agent.model.completed', { turn: 1, usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 }, toolCallCount: 1 }, refs),
    createEvent('agent.tool.completed', { tool: 'fs.patch', status: 'pass', target: 'src/auth.mjs', receiptSha256: 'a'.repeat(64) }, refs),
    createEvent('mission.task.awaiting-verification', { receiptCount: 1 }, refs),
  ]) store.appendEvent(event);

  const projection = new ActivityProjection({ store, staleAfterMs: 60_000, clock: () => Date.parse('2026-07-28T01:00:30.000Z') });
  const snapshot = projection.snapshot({ missionId: mission.id });

  assert.equal(snapshot.mission.id, mission.id);
  assert.equal(snapshot.currentPhase, 'testing');
  assert.equal(snapshot.usage.totalTokens, 160);
  assert.equal(snapshot.activities.some((item) => item.title === 'Đã chọn 2 tệp liên quan'), true);
  assert.equal(snapshot.activities.some((item) => item.title === 'Đã cập nhật src/auth.mjs'), true);
  assert.equal(snapshot.activities.at(-1).title, 'Đang kiểm tra kết quả');
  assert.equal(snapshot.activities.some((item) => JSON.stringify(item).includes('executionWorkspace')), false);
  assert.equal(JSON.stringify(snapshot).includes('receiptSha256'), false);
});

test('ActivityProjection exposes model wait state, heartbeat, failure, and completion without raw secrets', async (t) => {
  const { store, project, mission, task } = await fixture(t);
  const refs = { projectId: project.id, missionId: mission.id, taskId: task.id, runId: 'run_1' };
  const request = store.appendEvent(createEvent('agent.model.requested', { turn: 2, providerId: 'claude', prompt: 'sk-secret' }, refs));
  const projection = new ActivityProjection({ store, staleAfterMs: 1_000, clock: () => Date.parse(request.time) + 2_000 });
  const waiting = projection.snapshot({ missionId: mission.id });
  assert.equal(waiting.currentPhase, 'building');
  assert.equal(waiting.active?.title, 'Claude đang suy luận');
  assert.equal(waiting.stale, true);
  assert.equal(JSON.stringify(waiting).includes('sk-secret'), false);

  store.appendEvent(createEvent('agent.failed', { error: 'provider failed with apiKey=sk-secret' }, refs));
  const failed = projection.snapshot({ missionId: mission.id });
  assert.equal(failed.currentPhase, 'failed');
  assert.match(failed.activities.at(-1).title, /gặp lỗi/i);
  assert.equal(JSON.stringify(failed).includes('sk-secret'), false);

  store.updateTask(task.id, { status: 'done' });
  store.updateMission(mission.id, { status: 'completed' });
  store.appendEvent(createEvent('mission.task.verified', { evidenceCount: 3 }, refs));
  const completed = projection.snapshot({ missionId: mission.id });
  assert.equal(completed.currentPhase, 'completed');
  assert.equal(completed.activities.at(-1).title, 'Đã kiểm chứng thay đổi');
});

test('ActivityProjection shows the exact safe verification failure and recovery instead of a generic red line', async (t) => {
  const { store, project, mission, task } = await fixture(t);
  const refs = { projectId: project.id, missionId: mission.id, taskId: task.id };
  store.appendEvent(createEvent('mission.task.awaiting-verification', {}, refs));
  store.appendEvent(createEvent('mission.task.verification-failed', { summary: 'Verification command 1 failed with exit code 1.', kind: 'verification-command', exitCode: 1 }, refs));
  store.updateTask(task.id, { status: 'failed', metadata: { verificationFailure: { summary: 'Verification command 1 failed with exit code 1.', exitCode: 1 } } });
  store.updateMission(mission.id, { status: 'failed', metadata: { failureStage: 'verification', failureReason: 'Verification command 1 failed with exit code 1.' } });
  store.appendEvent(createEvent('run.autopilot.failed', { error: 'Verification command 1 failed with exit code 1.', stage: 'verification', taskId: task.id }, refs));

  const failed = new ActivityProjection({ store }).snapshot({ missionId: mission.id });
  assert.equal(failed.currentPhase, 'failed');
  assert.equal(failed.activities.some((item) => item.title === 'Kiểm thử chưa vượt qua'), true);
  assert.equal(failed.activities.some((item) => /exit code 1/i.test(item.explanation)), true);

  store.updateTask(task.id, { status: 'ready' });
  store.updateMission(mission.id, { status: 'running' });
  store.appendEvent(createEvent('run.recovery.started', { reason: 'follow-up-after-failure', recoveredTasks: 1 }, refs));
  const recovered = new ActivityProjection({ store }).snapshot({ missionId: mission.id });
  assert.equal(recovered.activities.at(-1).title, 'Đang tiếp tục từ lỗi trước');
  assert.equal(recovered.activities.at(-1).status, 'active');
});

test('ActivityProjection shows active tool work and useful result metadata', async (t) => {
  const { store, project, mission, task } = await fixture(t);
  const refs = { projectId: project.id, missionId: mission.id, taskId: task.id };
  store.appendEvent(createEvent('agent.tool.started', { tool: 'fs.patch', target: 'src/app.mjs' }, refs));
  let snapshot = new ActivityProjection({ store }).snapshot({ missionId: mission.id });
  assert.equal(snapshot.active.title, 'Đang cập nhật src/app.mjs');
  assert.equal(snapshot.active.status, 'active');
  store.appendEvent(createEvent('agent.tool.completed', { tool: 'fs.patch', target: 'src/app.mjs', status: 'pass', durationMs: 42, bytes: 120 }, refs));
  snapshot = new ActivityProjection({ store }).snapshot({ missionId: mission.id });
  assert.equal(snapshot.activities.at(-1).title, 'Đã cập nhật src/app.mjs');
  assert.equal(snapshot.activities.at(-1).details.durationMs, 42);
  assert.equal(snapshot.activities.at(-1).details.bytes, 120);
});

test('ActivityProjection shows durable goal discoveries, plan changes, browser work, plugins, and schedules', async (t) => {
  const { store, project, mission } = await fixture(t);
  const goal = store.createGoal({ projectId: project.id, title: 'Ship Goal OS', objective: 'Ship', status: 'active', successCriteria: [], budget: {}, schedule: { kind: 'manual' }, assumptions: [], metadata: {} });
  store.updateMission(mission.id, { metadata: { goalId: goal.id } });
  const refs = { projectId: project.id, goalId: goal.id, missionId: mission.id };
  store.appendEvent(createEvent('goal.fact.recorded', { factId: 'fact_1', impact: 'high', claim: 'YouTube requires a browser session' }, { projectId: project.id, goalId: goal.id }));
  store.appendEvent(createEvent('goal.plan.patch-proposed', { patchId: 'patch_1', reason: 'Add browser verification', addCount: 1, updateCount: 0, cancelCount: 0 }, refs));
  store.appendEvent(createEvent('goal.plan.patch-applied', { patchId: 'patch_1', changedTaskIds: [], addedTaskIds: ['task_new'] }, refs));
  store.appendEvent(createEvent('agent.browser.tools-authorized', { actions: ['open', 'snapshot'] }, refs));
  store.appendEvent(createEvent('agent.plugins.selected', { plugins: ['feature-dev'] }, refs));
  store.appendEvent(createEvent('goal.schedule.started', { schedule: 'interval' }, { projectId: project.id, goalId: goal.id }));
  const snapshot = new ActivityProjection({ store }).snapshot({ missionId: mission.id });
  const titles = snapshot.activities.map((item) => item.title);
  assert.equal(titles.includes('Đã phát hiện thông tin mới'), true);
  assert.equal(titles.includes('Kế hoạch cần được điều chỉnh'), true);
  assert.equal(titles.includes('Đã cập nhật kế hoạch'), true);
  assert.equal(titles.includes('Đã cấp công cụ trình duyệt'), true);
  assert.equal(titles.includes('Đã nạp plugin phù hợp'), true);
  assert.equal(titles.includes('Goal đang chạy theo lịch'), true);
});
