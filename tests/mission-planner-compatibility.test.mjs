import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionPlanner } from '../src/orchestration/mission-planner.mjs';
import { TaskGraph } from '../src/orchestration/task-graph.mjs';

const plan = { summary: 'Plan', tasks: [
  { id: 'inspect', title: 'Inspect', objective: 'Inspect', role: 'scout', dependencies: [], allowedPaths: ['**'], deniedPaths: [] },
  { id: 'build', title: 'Build', objective: 'Build', role: 'builder', dependencies: ['inspect'], allowedPaths: ['src/**'], deniedPaths: [] },
  { id: 'review', title: 'Review', objective: 'Review', role: 'reviewer', dependencies: ['build'], allowedPaths: ['**'], deniedPaths: [] },
] };

test('mission planner compatibility produces bounded dependencies and parallel-ready steps', async () => {
  const planner = new MissionPlanner({ router: { select: () => ({ id: 'p', async complete() { return { text: JSON.stringify(plan) }; } }) } });
  const result = await planner.plan({ projectId: 'p', objective: 'Build safely' });
  const graph = TaskGraph.validate(result.tasks);
  assert.deepEqual(graph.ready(new Map()), ['inspect']);
  assert.equal(result.tasks.find((item) => item.id === 'review').dependencies[0], 'build');
});

test('mission planner compatibility rejects cycles invalid roles and stale unsafe plans', async () => {
  assert.throws(() => TaskGraph.validate([
    { id: 'a', title: 'A', objective: 'A', role: 'scout', dependencies: ['b'] },
    { id: 'b', title: 'B', objective: 'B', role: 'builder', dependencies: ['a'] },
  ]), /cycle/i);
  const planner = new MissionPlanner({ router: { select: () => ({ id: 'p', async complete() { return { text: JSON.stringify({ tasks: [{ id: 'x', title: 'X', objective: 'X', role: 'admin', dependencies: [], allowedPaths: ['**'] }] }) }; } }) }, maxAttempts: 1 });
  await assert.rejects(() => planner.plan({ projectId: 'p', objective: 'Build' }), /role|planner/i);
});
