import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { AdaptiveReplanner } from '../src/goals/adaptive-replanner.mjs';
import { GoalToolGateway } from '../src/goals/goal-tool-gateway.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-goal-tool-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goals = new GoalService({ store });
  const goal = goals.create({ projectId: project.id, title: 'Ship', objective: 'Ship safely.' });
  const mission = store.createMission({ projectId: project.id, objective: 'Ship', status: 'running' });
  goals.attachMission(goal.id, mission.id, { relation: 'primary' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Scout', objective: 'Discover risks', status: 'running', role: 'scout', metadata: { goalId: goal.id, goalAutoApplyPlanPatches: true } });
  return { store, project, goals, goal, mission, task, gateway: new GoalToolGateway({ goalService: goals, replanner: new AdaptiveReplanner({ store, goalService: goals }) }) };
}

test('GoalToolGateway exposes goal tools only for goal-linked tasks and records evidence-driven findings', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.gateway.schemasForTask({ ...f.task, metadata: {} }), []);
  assert.deepEqual(f.gateway.schemasForTask(f.task).map((item) => item.function.name), ['goal.record_finding', 'goal.status']);
  const result = await f.gateway.execute(f.task, 'goal.record_finding', { claim: 'Tests require a new fixture.', confidence: 0.95, impact: 'high', source: { kind: 'test', id: 't1' }, receiptSha256: 'a'.repeat(64), reason: 'Add fixture task.', proposedPatch: { addTasks: [{ key: 'fixture', title: 'Build fixture', objective: 'Add fixture', role: 'builder', dependencies: [], allowedPaths: ['tests/**'] }] }, idempotencyKey: 't1' });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.fact.claim, 'Tests require a new fixture.');
  assert.equal(result.output.patch.status, 'applied');
  assert.equal(f.store.listTasks({ missionId: f.mission.id }).some((task) => task.metadata.planTaskKey === 'fixture'), true);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('GoalToolGateway does not auto-apply patches without explicit task grant', async (t) => {
  const f = await fixture(t);
  const task = f.store.updateTask(f.task.id, { metadata: { goalId: f.goal.id, goalAutoApplyPlanPatches: false } });
  const result = await f.gateway.execute(task, 'goal.record_finding', { claim: 'Need another check.', confidence: 0.8, impact: 'high', source: { kind: 'review' }, proposedPatch: { addTasks: [{ key: 'check', title: 'Check', objective: 'Check', role: 'reviewer' }] }, reason: 'Review required.' });
  assert.equal(result.output.patch.status, 'proposed');
  await assert.rejects(() => f.gateway.execute({ ...task, metadata: {} }, 'goal.status', {}), /not linked/i);
});
