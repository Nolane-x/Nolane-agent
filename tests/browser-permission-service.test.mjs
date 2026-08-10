import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { BrowserPermissionService } from '../src/security/browser-permission-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-permissions-'));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goals = new GoalService({ store });
  const goal = goals.create({ projectId: project.id, title: 'Browse', objective: 'Inspect and update a web form.', metadata: { browserAllowedActions: ['open', 'snapshot'] } });
  const mission = store.createMission({ projectId: project.id, objective: goal.objective, status: 'running', metadata: { goalId: goal.id, browserAllowedActions: ['open', 'snapshot'] } });
  goals.attachMission(goal.id, mission.id, { relation: 'primary' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Use browser', objective: 'Fill form.', status: 'ready', role: 'builder', allowedPaths: [], deniedPaths: [], metadata: { goalId: goal.id, browserAllowedActions: ['open', 'snapshot'] } });
  return { store, goals, goal: goals.get(goal.id), mission, task, service: new BrowserPermissionService({ store, goalService: goals }) };
}

test('browser permissions persist explicit write grants and propagate them to active mission tasks', async (t) => {
  const f = await fixture(t);
  const granted = f.service.grant({ goalId: f.goal.id, actions: ['click', 'fill', 'press'] });
  assert.deepEqual(granted.writeActions, ['click', 'fill', 'press']);
  assert.deepEqual(f.goals.get(f.goal.id).metadata.browserAllowedActions, ['open', 'snapshot', 'click', 'fill', 'press']);
  assert.deepEqual(f.store.getMission(f.mission.id).metadata.browserAllowedActions, ['open', 'snapshot', 'click', 'fill', 'press']);
  assert.deepEqual(f.store.getTask(f.task.id).metadata.browserAllowedActions, ['open', 'snapshot', 'click', 'fill', 'press']);
});

test('browser permissions revoke write actions, reject unknown actions, and preserve read actions', async (t) => {
  const f = await fixture(t);
  f.service.grant({ goalId: f.goal.id, actions: ['click', 'fill'] });
  const revoked = f.service.revoke({ goalId: f.goal.id, actions: ['click'] });
  assert.deepEqual(revoked.allowedActions, ['open', 'snapshot', 'fill']);
  assert.throws(() => f.service.grant({ goalId: f.goal.id, actions: ['purchase'] }), /unsupported browser write action/i);
});
