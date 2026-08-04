import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { AdaptiveReplanner } from '../src/goals/adaptive-replanner.mjs';
import { MissionGraphProjection } from '../src/orchestration/mission-graph-projection.mjs';
import { createEvent } from '../src/protocol/events.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goals = new GoalService({ store });
  const goal = goals.create({ projectId: project.id, title: 'Ship Goal OS', objective: 'Ship a verified Goal OS.' });
  const mission = store.createMission({ projectId: project.id, objective: 'Implement graph', status: 'running' });
  goals.attachMission(goal.id, mission.id, { relation: 'primary' });
  const scout = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Explore', objective: 'Explore system', status: 'done', role: 'scout' });
  const builder = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Build graph', objective: 'Build graph', status: 'running', role: 'builder', dependencies: [scout.id], allowedPaths: ['src/**'] });
  const reviewer = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Review graph', objective: 'Review graph', status: 'blocked', role: 'reviewer', dependencies: [builder.id] });
  const run = store.createRun({ taskId: builder.id, providerId: 'codex', state: 'running', checkpoint: { turn: 2 } });
  return { store, project, goals, goal, mission, scout, builder, reviewer, run };
}

test('MissionGraphProjection presents goal, tasks, agents, dependencies, discoveries, replans, usage, and blockers', async (t) => {
  const f = await fixture(t);
  const replanner = new AdaptiveReplanner({ store: f.store, goalService: f.goals });
  replanner.observe({ goalId: f.goal.id, finding: { claim: 'Graph rendering needs virtualization.', confidence: 0.9, impact: 'high', source: { kind: 'benchmark', id: 'b1' }, receiptSha256: 'c'.repeat(64) }, proposedPatch: { addTasks: [{ key: 'virtualize', title: 'Virtualize graph', objective: 'Virtualize large graphs', role: 'builder', dependencies: [f.builder.id], allowedPaths: ['ui/**'] }] }, reason: 'Large graphs exceed render budget.', idempotencyKey: 'b1' });
  f.store.appendEvent(createEvent('agent.model.completed', { providerId: 'codex', usage: { inputTokens: 1200, outputTokens: 300, totalTokens: 1500 } }, { projectId: f.project.id, goalId: f.goal.id, missionId: f.mission.id, taskId: f.builder.id, runId: f.run.id }));
  f.store.appendEvent(createEvent('agent.tool.started', { tool: 'fs.patch', target: 'src/orchestration/mission-graph-projection.mjs' }, { projectId: f.project.id, goalId: f.goal.id, missionId: f.mission.id, taskId: f.builder.id, runId: f.run.id }));
  const graph = new MissionGraphProjection({ store: f.store }).snapshot({ goalId: f.goal.id });

  assert.equal(graph.goal.id, f.goal.id);
  assert.equal(graph.mission.id, f.mission.id);
  assert.equal(graph.usage.totalTokens, 1500);
  assert.equal(graph.active.target, 'src/orchestration/mission-graph-projection.mjs');
  assert.equal(graph.discoveries[0].claim, 'Graph rendering needs virtualization.');
  assert.equal(graph.planPatches[0].status, 'proposed');
  assert.equal(graph.blockers.some((item) => item.taskId === f.reviewer.id), true);
  assert.equal(graph.nodes.some((node) => node.id === `task:${f.builder.id}` && node.kind === 'task'), true);
  assert.equal(graph.nodes.some((node) => node.id === 'agent:codex' && node.kind === 'agent'), true);
  assert.equal(graph.edges.some((edge) => edge.from === `task:${f.scout.id}` && edge.to === `task:${f.builder.id}` && edge.kind === 'depends-on'), true);
  assert.equal(graph.edges.some((edge) => edge.from === `task:${f.builder.id}` && edge.to === `task:${f.reviewer.id}`), true);
  assert.ok(Object.isFrozen(graph));
});

test('MissionGraphProjection bounds event and graph output and supports mission-only snapshots', async (t) => {
  const f = await fixture(t);
  for (let index = 0; index < 30; index += 1) f.store.appendEvent(createEvent('agent.model.completed', { providerId: 'codex', usage: { totalTokens: 10 } }, { projectId: f.project.id, missionId: f.mission.id, taskId: f.builder.id }));
  const graph = new MissionGraphProjection({ store: f.store, maxEvents: 10, maxNodes: 5 }).snapshot({ missionId: f.mission.id });
  assert.equal(graph.events.length, 10);
  assert.equal(graph.nodes.length <= 5, true);
  assert.equal(graph.usage.totalTokens, 100);
  assert.equal(graph.truncated.events, true);
});
