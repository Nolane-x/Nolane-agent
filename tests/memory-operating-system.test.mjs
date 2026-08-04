import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { MemoryOperatingSystem } from '../src/memory/memory-operating-system.mjs';
import { MemoryService } from '../src/memory/memory-service.mjs';
import { ProjectMemorySidecar } from '../src/memory/project-memory-sidecar.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-memory-os-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Memory OS', workspaceRoot: root });
  const memoryService = new MemoryService({ store, memoryRoot: path.join(root, 'memory') });
  const sidecar = new ProjectMemorySidecar({ store, memoryService, clock: () => 1_000 });
  const operatingSystem = new MemoryOperatingSystem({ store, memoryService, memorySidecar: sidecar, clock: () => 1_000 });
  return { root, store, project, memoryService, sidecar, operatingSystem };
}

async function activeMemory(f, { title, content, kind = 'episodic' }) {
  const item = await f.sidecar.propose({ projectId: f.project.id, title, content, kind, citations: [] });
  return f.sidecar.approve(item.id, { actor: 'user:alice', evidenceReceiptSha256: 'a'.repeat(64) });
}

test('MemoryOperatingSystem records immutable versions and supports scoped suppress/deprioritize', async (t) => {
  const f = await fixture(t);
  const memory = await activeMemory(f, { title: 'Session policy', content: 'Session cache is invalidated by rotation events.' });
  const sourceHash = hash(memory.content);

  const suppressed = await f.operatingSystem.apply({ projectId: f.project.id, memoryId: memory.id, operation: 'suppress', actor: 'user:alice', scope: { taskId: 'task-1' }, reason: 'not relevant to this task', sourceHash, evidenceReceiptSha256: 'b'.repeat(64) });
  const deprioritized = await f.operatingSystem.apply({ projectId: f.project.id, memoryId: memory.id, operation: 'deprioritize', actor: 'user:alice', scope: { projectId: f.project.id }, priorityDelta: -0.4, reason: 'weak transfer evidence', sourceHash, evidenceReceiptSha256: 'c'.repeat(64) });

  assert.equal(suppressed.operation, 'suppress');
  assert.equal(deprioritized.parentVersionId, suppressed.versionId);
  assert.equal(f.operatingSystem.versions(memory.id).length, 3);
  assert.equal(f.operatingSystem.retrieve(f.project.id, 'session cache', { taskId: 'task-1' }).length, 0);
  assert.equal(f.operatingSystem.retrieve(f.project.id, 'session cache', { taskId: 'task-2' })[0].memoryId, memory.id);
  assert.equal(f.operatingSystem.retrieve(f.project.id, 'session cache', { taskId: 'task-2' })[0].priorityDelta, -0.4);
});

test('MemoryOperatingSystem keeps validity intervals and lets exception memory override a schema', async (t) => {
  let now = 1_000;
  const f = await fixture(t);
  f.operatingSystem.clock = () => now;
  const schema = await activeMemory(f, { title: 'Module format', content: 'All packages use ESM.', kind: 'semantic' });
  await f.operatingSystem.apply({ projectId: f.project.id, memoryId: schema.id, operation: 'abstract', actor: 'reviewer', layer: 'semantic_schema', abstractedTitle: 'Repository module schema', abstractedContent: 'Packages use ESM unless a verified exception exists.', sourceHash: hash(schema.content), evidenceReceiptSha256: 'd'.repeat(64) });
  now = 2_000;
  const exception = await activeMemory(f, { title: 'Legacy migration exception', content: 'scripts/legacy-migration.cjs must remain CommonJS.', kind: 'exception' });
  await f.operatingSystem.apply({ projectId: f.project.id, memoryId: exception.id, operation: 'abstract', actor: 'reviewer', layer: 'exception', abstractedTitle: exception.title, abstractedContent: exception.content, sourceHash: hash(exception.content), evidenceReceiptSha256: 'e'.repeat(64) });

  const schemaVersions = f.operatingSystem.versions(schema.id);
  assert.equal(schemaVersions[0].validUntilMs, 1_000);
  assert.equal(schemaVersions.at(-1).validFromMs, 1_000);
  const results = f.operatingSystem.retrieve(f.project.id, 'legacy migration commonjs esm');
  assert.equal(results[0].layer, 'exception');
  assert.equal(results[1].layer, 'semantic_schema');
});

test('MemoryOperatingSystem invalidates, archives, and privacy-deletes without retaining private content', async (t) => {
  const f = await fixture(t);
  const invalid = await activeMemory(f, { title: 'Old endpoint', content: 'Use /v1/session.' });
  await f.operatingSystem.apply({ projectId: f.project.id, memoryId: invalid.id, operation: 'invalidate', actor: 'reviewer', reason: 'endpoint removed', sourceHash: hash(invalid.content), evidenceReceiptSha256: 'f'.repeat(64) });
  assert.equal(f.operatingSystem.retrieve(f.project.id, 'v1 session').length, 0);

  const archived = await activeMemory(f, { title: 'Historical decision', content: 'The old queue used polling.' });
  await f.operatingSystem.apply({ projectId: f.project.id, memoryId: archived.id, operation: 'archive', actor: 'user:alice', reason: 'historical only', sourceHash: hash(archived.content), evidenceReceiptSha256: '1'.repeat(64) });
  assert.equal(f.operatingSystem.retrieve(f.project.id, 'old queue polling').length, 0);
  assert.equal(f.operatingSystem.versions(archived.id).at(-1).operation, 'archive');

  const privateMemory = await activeMemory(f, { title: 'Private note', content: 'credential material must disappear' });
  const deleted = await f.operatingSystem.apply({ projectId: f.project.id, memoryId: privateMemory.id, operation: 'delete', actor: 'user:alice', reason: 'privacy request', privacy: true, sourceHash: hash(privateMemory.content), evidenceReceiptSha256: '2'.repeat(64) });
  assert.equal(deleted.deleted, true);
  assert.equal(f.memoryService.get(privateMemory.id), null);
  assert.deepEqual(f.operatingSystem.versions(privateMemory.id), []);
  const tombstone = f.store.db.prepare('SELECT * FROM memory_tombstones WHERE memory_id=?').get(privateMemory.id);
  assert.equal(tombstone.reason, 'privacy request');
  assert.doesNotMatch(JSON.stringify(tombstone), /credential material/);
});

test('MemoryOperatingSystem rejects private fields and invalid evidence', async (t) => {
  const f = await fixture(t);
  const memory = await activeMemory(f, { title: 'Safe', content: 'Safe content.' });
  await assert.rejects(() => f.operatingSystem.apply({ projectId: f.project.id, memoryId: memory.id, operation: 'suppress', actor: 'user', rawPrompt: 'secret', sourceHash: hash(memory.content), evidenceReceiptSha256: '3'.repeat(64) }), /private|raw/i);
  await assert.rejects(() => f.operatingSystem.apply({ projectId: f.project.id, memoryId: memory.id, operation: 'suppress', actor: 'user', sourceHash: hash(memory.content), evidenceReceiptSha256: 'bad' }), /SHA-256/i);
});
