import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { AdaptiveReplanner } from '../src/goals/adaptive-replanner.mjs';
import { GoalToolGateway } from '../src/goals/goal-tool-gateway.mjs';
import { TaskScheduler } from '../src/orchestration/task-graph.mjs';
import { MissionRunner } from '../src/orchestration/mission-runner.mjs';

const plan = { summary: 'Inspect and review.', tasks: [
  { id: 'scout', title: 'Scout', objective: 'Inspect.', role: 'scout', dependencies: [], allowedPaths: ['**'] },
  { id: 'review', title: 'Review', objective: 'Review.', role: 'reviewer', dependencies: ['scout'], allowedPaths: ['**'] },
] };

test('discoveries from a running goal-linked task automatically patch the live mission plan', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-live-replan-')); t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goals = new GoalService({ store });
  const goal = goals.create({ projectId: project.id, title: 'Ship', objective: 'Ship.', metadata: { goalAutoApplyPlanPatches: true } });
  const mission = store.createMission({ projectId: project.id, objective: goal.objective, status: 'planning', metadata: { goalId: goal.id, goalAutoApplyPlanPatches: true } });
  goals.attachMission(goal.id, mission.id, { relation: 'primary' });
  const runner = new MissionRunner({ store, scheduler: new TaskScheduler({ store }), agentLoop: { run: async () => ({ runId: 'r', output: '', receipts: [] }) }, forge: { recordEvidence: async () => ({}) } });
  const planned = await runner.plan({ missionId: mission.id, projectId: project.id, objective: goal.objective, planner: async () => plan });
  const task = planned.tasks[0];
  const gateway = new GoalToolGateway({ goalService: goals, replanner: new AdaptiveReplanner({ store, goalService: goals }) });
  const result = await gateway.execute(task, 'goal.record_finding', {
    claim: 'The repository uses a separate generated client that must be refreshed.', impact: 'high', confidence: 0.95,
    proposedPatch: { addTasks: [{ key: 'refresh-client', title: 'Refresh generated client', objective: 'Regenerate and verify the client.', role: 'builder', dependencies: [], allowedPaths: ['generated/**'] }] },
    reason: 'New repository discovery changes the implementation plan.', idempotencyKey: 'generated-client',
  });
  assert.equal(result.output.patch.status, 'applied');
  assert.equal(store.listTasks({ missionId: mission.id }).some((item) => item.metadata.planTaskKey === 'refresh-client'), true);
  assert.equal(store.listGoalPlanRevisions(goal.id).length, 1);
});
