import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { loadConfig } from '../src/config.mjs';
import { createEvent } from '../src/protocol/events.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

test('loadConfig resolves paths and applies lightweight bounded defaults', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-studio-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = loadConfig({ dataDir: './data', workspaceRoot: root, port: 0, totalMemoryBytes: 8 * 1024 ** 3 });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 0);
  assert.equal(config.dataDir, path.resolve('./data'));
  assert.equal(config.workspaceRoot, path.resolve(root));
  assert.equal(config.budgets.maxTurns, 24);
  assert.equal(config.budgets.maxToolCalls, 64);
  assert.equal(config.performance.profile, 'lite');
  assert.equal(config.performance.maxActiveAgents, 1);
  assert.equal(config.performance.maxVisibleTerminals, 2);
  assert.equal(config.performance.maxEditorModels, 4);
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.budgets));
});

test('loadConfig refuses non-loopback bind addresses by default', () => {
  assert.throws(() => loadConfig({ host: '0.0.0.0' }), /loopback/i);
});

test('createEvent returns a deeply immutable stable envelope', () => {
  const event = createEvent('task.created', { title: 'Build' }, { projectId: 'project_1', taskId: 'task_1' });
  assert.match(event.id, /^evt_/);
  assert.equal(event.schema, 'forge.studio.event.v1');
  assert.equal(event.type, 'task.created');
  assert.equal(event.refs.projectId, 'project_1');
  assert.equal(event.payload.title, 'Build');
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.refs));
  assert.ok(Object.isFrozen(event.payload));
  assert.throws(() => { event.payload.title = 'Mutated'; }, TypeError);
});

test('StudioStore migrates and persists projects, tasks, and append-only events', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-studio-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'studio.db');
  const store = new StudioStore(file);
  t.after(() => store.close());

  const project = store.createProject({ name: 'Forge Studio', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build a real agent' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Create core', objective: 'Ship tested core' });
  const event = store.appendEvent(createEvent('task.created', { title: task.title }, { projectId: project.id, missionId: mission.id, taskId: task.id }));

  assert.equal(store.getProject(project.id).name, 'Forge Studio');
  assert.equal(store.listProjects().length, 1);
  assert.equal(store.getTask(task.id).status, 'todo');
  assert.equal(store.listTasks({ missionId: mission.id }).length, 1);
  assert.equal(store.listEvents({ afterSeq: 0 }).at(-1).id, event.id);

  const second = new StudioStore(file);
  t.after(() => second.close());
  assert.equal(second.getTask(task.id).objective, 'Ship tested core');

  const raw = new DatabaseSync(file);
  t.after(() => raw.close());
  assert.throws(() => raw.exec(`UPDATE events SET type='tampered' WHERE id='${event.id}'`), /append-only/i);
  assert.throws(() => raw.exec(`DELETE FROM events WHERE id='${event.id}'`), /append-only/i);
});
