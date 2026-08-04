import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { DynamicContextStore } from '../src/agent/dynamic-context-store.mjs';
import { createEvent } from '../src/protocol/events.mjs';
import { TraceEvidenceCenterService } from '../src/operations/trace-evidence-center-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-trace-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Trace Project', workspaceRoot: root });
  const other = store.createProject({ name: 'Other Project', workspaceRoot: path.join(root, 'other') });
  const mission = store.createMission({ projectId: project.id, objective: 'Build trace center' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Trace', objective: 'Trace', role: 'builder' });
  const contextStore = new DynamicContextStore({ root: path.join(root, 'artifacts') });
  const service = new TraceEvidenceCenterService({ version: '1.6.0', store, contextStore, clock: () => '2026-07-29T06:30:00.000Z' });
  return { root, store, project, other, mission, task, contextStore, service };
}

function append(store, type, projectId, payload = {}, refs = {}) {
  return store.appendEvent(createEvent(type, payload, { projectId, ...refs }));
}

test('TraceEvidenceCenterService builds a redacted project-scoped timeline, receipt graph, claims, and failure clusters', async (t) => {
  const f = await fixture(t);
  append(f.store, 'tool.completed', f.project.id, { tool: 'process.run', status: 'pass', receiptSha256: 'a'.repeat(64), artifactSha256: 'b'.repeat(64), password: 'password=supersecretvalue' }, { missionId: f.mission.id, taskId: f.task.id });
  append(f.store, 'mission.task.verification-failed', f.project.id, { code: 'TEST_FAILED', summary: 'Unit test failed at src/a.mjs', exitCode: 1, receiptSha256: 'c'.repeat(64) }, { missionId: f.mission.id, taskId: f.task.id });
  append(f.store, 'mission.task.verification-failed', f.project.id, { code: 'TEST_FAILED', summary: 'Unit test failed at src/b.mjs', exitCode: 1, receiptSha256: 'd'.repeat(64) }, { missionId: f.mission.id, taskId: f.task.id });
  append(f.store, 'goal.fact.discovered', f.project.id, { claim: 'Authentication uses refresh tokens.', confidence: 0.91, receiptSha256: 'e'.repeat(64) }, { missionId: f.mission.id });
  append(f.store, 'tool.completed', f.other.id, { receiptSha256: 'f'.repeat(64), secret: 'sk-abcdefghijklmnopqrstuv' });
  f.store.addEvidence({ projectId: f.project.id, taskId: f.task.id, kind: 'test-full', status: 'pass', receiptSha256: '1'.repeat(64), payload: { commit: '2'.repeat(40), artifactSha256: '3'.repeat(64), sourceReceiptSha256: 'a'.repeat(64), summary: 'Full test passed.' } });

  const snapshot = await f.service.snapshot({ projectId: f.project.id, principalId: 'local-admin', missionId: f.mission.id, limit: 100 });
  assert.equal(snapshot.schema, 'forge.trace-evidence-center.v1');
  assert.equal(snapshot.version, '1.6.0');
  assert.equal(snapshot.projectId, f.project.id);
  assert.equal(snapshot.summary.events, 4);
  assert.equal(snapshot.summary.evidence, 1);
  assert.equal(snapshot.summary.claims, 1);
  assert.equal(snapshot.summary.failureClusters, 1);
  assert.equal(snapshot.failures[0].count, 2);
  assert.equal(snapshot.claims[0].claim, 'Authentication uses refresh tokens.');
  assert.ok(snapshot.graph.nodes.some((node) => node.id === `receipt:${'a'.repeat(64)}`));
  assert.ok(snapshot.graph.edges.some((edge) => edge.type === 'derived-from'));
  assert.doesNotMatch(JSON.stringify(snapshot), /supersecretvalue|sk-abcdefghijklmnopqrstuv/);
  assert.doesNotMatch(JSON.stringify(snapshot), new RegExp(f.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
});

test('TraceEvidenceCenterService paginates events, rejects cross-project task filters, and exports immutable evidence artifacts', async (t) => {
  const f = await fixture(t);
  for (let index = 0; index < 8; index += 1) append(f.store, 'agent.step', f.project.id, { index, receiptSha256: String(index).padStart(64, '0') }, { missionId: f.mission.id, taskId: f.task.id });
  const page = await f.service.events({ projectId: f.project.id, principalId: 'owner', afterSeq: 0, limit: 3 });
  assert.equal(page.items.length, 3);
  assert.ok(page.nextSeq > 0);
  const exported = await f.service.exportBundle({ projectId: f.project.id, principalId: 'owner', missionId: f.mission.id, label: 'Release evidence' });
  assert.equal(exported.schema, 'forge.trace-evidence-export.v1');
  assert.equal(exported.artifact.kind, 'trace-evidence-export');
  assert.equal(exported.artifact.filePath, undefined);
  assert.match(exported.artifact.sha256, /^[a-f0-9]{64}$/);
  const artifact = await f.contextStore.get(exported.artifact.id);
  assert.equal(artifact.refs.projectId, f.project.id);
  assert.match(exported.receiptSha256, /^[a-f0-9]{64}$/);
  const otherMission = f.store.createMission({ projectId: f.other.id, objective: 'Other' });
  const otherTask = f.store.createTask({ projectId: f.other.id, missionId: otherMission.id, title: 'Other', objective: 'Other', role: 'builder' });
  await assert.rejects(() => f.service.snapshot({ projectId: f.project.id, principalId: 'owner', taskId: otherTask.id }), /scope|project/i);
});
