import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { DynamicContextStore } from '../src/agent/dynamic-context-store.mjs';
import { ContextHistoryArchive } from '../src/agent/context-history-archive.mjs';
import { MemoryService } from '../src/memory/memory-service.mjs';
import { ProjectMemorySidecar } from '../src/memory/project-memory-sidecar.mjs';
import { ContextMemoryCenterService } from '../src/context/context-memory-center-service.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-context-memory-center-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Context Project', workspaceRoot: root });
  const contextStore = new DynamicContextStore({ root: path.join(root, 'artifacts'), previewBytes: 96 });
  const history = new ContextHistoryArchive({ file: path.join(root, 'history.db'), contextStore, clock: () => '2026-07-29T00:00:00.000Z' });
  t.after(() => history.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const memory = new MemoryService({ store, memoryRoot: path.join(root, 'memory') });
  const sidecar = new ProjectMemorySidecar({ store, memoryService: memory, clock: () => Date.parse('2026-07-29T00:00:00.000Z') });
  const source = 'export const buildCommand = "npm test";\n';
  await writeFile(path.join(root, 'build.mjs'), source);
  const proposed = await sidecar.propose({ projectId: project.id, title: 'Build command', content: 'Use npm test before release.', citations: [{ path: 'build.mjs', startLine: 1, endLine: 1, sha256: sha(source), commit: 'abc123' }], ttlMs: 60_000, actor: 'agent' });
  await sidecar.approve(proposed.id, { actor: 'owner', evidenceReceiptSha256: 'a'.repeat(64) });
  const archived = await history.archiveConversation({ projectId: project.id, missionId: 'm1', sessionId: 's1', messages: [{ id: 'msg1', role: 'user', content: 'Remember the build command.', createdAt: '2026-07-29T00:00:00.000Z' }] });
  const service = new ContextMemoryCenterService({ version: '1.5.0', store, historyArchive: history, contextStore, memoryService: memory, memorySidecar: sidecar });
  return { root, store, project, contextStore, history, memory, sidecar, proposed, archived, service };
}

test('ContextMemoryCenterService returns bounded project-scoped history, memory, pins, and role budgets', async (t) => {
  const f = await fixture(t);
  const pin = await f.service.pinArtifact({ projectId: f.project.id, artifactId: f.archived.artifact.id, label: 'Release discussion', principalId: 'local-admin' });
  assert.match(pin.receiptSha256, /^[a-f0-9]{64}$/);
  const snapshot = await f.service.snapshot({ projectId: f.project.id, principalId: 'local-admin' });
  assert.equal(snapshot.schema, 'forge.context-memory-center.v1');
  assert.equal(snapshot.version, '1.5.0');
  assert.equal(snapshot.summary.archives, 1);
  assert.equal(snapshot.summary.activeMemories, 1);
  assert.equal(snapshot.summary.pinnedArtifacts, 1);
  assert.equal(snapshot.budgets.executor, 48_000);
  assert.equal(snapshot.history[0].artifact.filePath, undefined);
  assert.equal(snapshot.memories[0].filePath, undefined);
  assert.equal(snapshot.memories[0].citations[0].path, 'build.mjs');
  assert.equal(snapshot.pins[0].label, 'Release discussion');
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(snapshot), new RegExp(f.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('ContextMemoryCenterService persists idempotent pins, enforces artifact project scope, and verifies freshness', async (t) => {
  const f = await fixture(t);
  const first = await f.service.pinArtifact({ projectId: f.project.id, artifactId: f.archived.artifact.id, label: 'Pinned', principalId: 'owner' });
  const repeated = await f.service.pinArtifact({ projectId: f.project.id, artifactId: f.archived.artifact.id, label: 'Pinned again', principalId: 'owner' });
  assert.equal(first.artifactId, repeated.artifactId);
  assert.equal((await f.service.snapshot({ projectId: f.project.id, principalId: 'owner' })).pins.length, 1);
  const freshness = await f.service.verifyMemory({ projectId: f.project.id, memoryId: f.proposed.id, principalId: 'owner' });
  assert.equal(freshness.fresh, true);
  await assert.rejects(() => f.service.pinArtifact({ projectId: 'other-project', artifactId: f.archived.artifact.id, principalId: 'owner' }), /scope|project/i);
  const removed = await f.service.unpinArtifact({ projectId: f.project.id, artifactId: f.archived.artifact.id, principalId: 'owner' });
  assert.equal(removed.unpinned, true);
});
