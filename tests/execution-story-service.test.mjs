import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ExecutionStoryService } from '../src/activity/execution-story-service.mjs';
import { ActivityProjection } from '../src/orchestration/activity-projection.mjs';
import { createEvent } from '../src/protocol/events.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-execution-story-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Story', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build execution story', status: 'running' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Implement story', objective: 'Implement', status: 'running', role: 'builder' });
  return { store, project, mission, task };
}

function appendStoryEvents(store, refs) {
  const receipt = 'a'.repeat(64);
  for (const event of [
    createEvent('run.created', { prompt: 'sk-secret-value' }, refs),
    createEvent('agent.tool.completed', { tool: 'fs.read', target: 'src/app.mjs', status: 'pass', bytes: 400 }, refs),
    createEvent('agent.tool.completed', { tool: 'fs.patch', target: 'src/activity/story.mjs', status: 'pass', receiptSha256: receipt }, refs),
    createEvent('agent.tool.completed', { tool: 'process.run', target: 'npm test', command: 'npm', args: ['test'], status: 'pass', exitCode: 0 }, refs),
    createEvent('mission.task.awaiting-verification', { testCount: 12 }, refs),
    createEvent('mission.task.verified', { evidenceIds: ['ev_1'], receiptSha256: receipt }, refs),
  ]) store.appendEvent(event);
}

test('Execution Story turns durable technical events into correlated level-specific phases', async (t) => {
  const { store, project, mission, task } = await fixture(t);
  appendStoryEvents(store, { projectId: project.id, missionId: mission.id, taskId: task.id, runId: 'run_1', laneId: 'lane_1' });
  const service = new ExecutionStoryService({ store, activityProjection: new ActivityProjection({ store }), clock: () => '2026-08-04T00:00:00.000Z' });

  const everyday = service.snapshot({ missionId: mission.id, level: 'everyday', language: 'en' });
  assert.equal(everyday.schema, 'nolane.execution-story.v1');
  assert.equal(everyday.events.length, 6);
  assert.equal(everyday.events.some((event) => event.references.files.length > 0), false);
  assert.equal(JSON.stringify(everyday).includes('src/app.mjs'), false);
  assert.equal(JSON.stringify(everyday).includes('sk-secret-value'), false);
  assert.equal(everyday.summary.filesRead, 1);
  assert.equal(everyday.summary.filesChanged, 1);
  assert.equal(everyday.summary.commands, 1);

  const studio = service.snapshot({ missionId: mission.id, level: 'studio', language: 'en' });
  assert.equal(studio.events.some((event) => event.references.files.includes('src/app.mjs')), true);
  assert.equal(studio.events.some((event) => event.references.command === 'npm'), true);
  assert.equal(studio.events.every((event) => event.correlation.missionId === mission.id), true);
  assert.equal(studio.summary.commands, 1);
  assert.equal(studio.summary.receipts, 1);
  assert.ok(studio.phases.length >= 3);
  assert.match(studio.receiptSha256, /^[a-f0-9]{64}$/);

  const expert = service.snapshot({ missionId: mission.id, level: 'expert', language: 'en' });
  assert.equal(expert.events.some((event) => event.metadata && event.sourceEventType === 'agent.tool.completed'), true);
  assert.equal(JSON.stringify(expert).includes('sk-secret-value'), false);
});

test('Execution Story supports cursor replay and immutable evidence export', async (t) => {
  const { store, project, mission, task } = await fixture(t);
  appendStoryEvents(store, { projectId: project.id, missionId: mission.id, taskId: task.id });
  const service = new ExecutionStoryService({ store, activityProjection: new ActivityProjection({ store }), clock: () => '2026-08-04T00:00:00.000Z' });
  const first = service.snapshot({ missionId: mission.id, level: 'workspace', limit: 2 });
  const next = service.snapshot({ missionId: mission.id, level: 'workspace', afterSeq: first.cursor.nextSeq });
  assert.equal(first.events.length, 2);
  assert.equal(next.events.length, 4);
  assert.equal(next.events.some((event) => first.events.some((old) => old.sourceEventId === event.sourceEventId)), false);
  const bundle = service.exportBundle({ missionId: mission.id });
  assert.equal(bundle.schema, 'nolane.execution-story-export.v1');
  assert.equal(bundle.story.level, 'expert');
  assert.match(bundle.receiptSha256, /^[a-f0-9]{64}$/);
});
