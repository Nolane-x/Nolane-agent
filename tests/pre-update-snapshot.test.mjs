import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { PreUpdateSnapshotService } from '../src/update/pre-update-snapshot.mjs';
import { UpdatePreparationService } from '../src/update/update-preparation-service.mjs';
import { UpdateMigrationJournal } from '../src/update/migration-journal.mjs';

async function rootFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-pre-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('StudioStore creates a consistent SQLite snapshot without closing the live store', async (t) => {
  const root = await rootFixture(t);
  const store = new StudioStore(path.join(root, 'nolane-agent.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Snapshot project', workspaceRoot: path.join(root, 'workspace') });
  store.createMission({ projectId: project.id, objective: 'Preserve me', status: 'planned' });
  const target = path.join(root, 'snapshot', 'nolane-agent.db');
  store.snapshotTo(target);
  assert.ok((await stat(target)).isFile());
  const copy = new StudioStore(target);
  t.after(() => copy.close());
  assert.equal(copy.listProjects().length, 1);
  assert.equal(copy.listMissions({}).length, 1);
  store.createMission({ projectId: project.id, objective: 'Live store still writable', status: 'planned' });
  assert.equal(store.listMissions({}).length, 2);
});

test('pre-update snapshot captures core DB and bounded product metadata while excluding credentials', async (t) => {
  const root = await rootFixture(t);
  await mkdir(path.join(root, 'settings'), { recursive: true });
  await mkdir(path.join(root, 'session'), { recursive: true });
  await mkdir(path.join(root, 'personalization'), { recursive: true });
  await writeFile(path.join(root, 'settings', 'user.json'), '{"general":{"language":"vi"}}');
  await writeFile(path.join(root, 'session', 'restore.json'), '{"activeRoute":"/missions"}');
  await writeFile(path.join(root, 'personalization', 'default.metadata.json'), '{"schema":"test"}');
  await writeFile(path.join(root, 'settings', 'api-token.json'), '{"token":"must-not-copy"}');
  const store = { snapshotTo: async (target) => writeFile(target, Buffer.from('sqlite-snapshot')) };
  const service = new PreUpdateSnapshotService({ dataDir: root, store, clock: () => '2026-08-03T20:00:00.000Z' });
  const snapshot = await service.create({ fromVersion: '5.0.0-beta.6', toVersion: '5.0.0-beta.7' });
  assert.equal(snapshot.schema, 'nolane.pre-update-snapshot.v1');
  assert.equal(snapshot.entries.some((entry) => entry.snapshotRelative === 'database/nolane-agent.db'), true);
  assert.equal(snapshot.entries.some((entry) => entry.snapshotRelative === 'settings/user.json'), true);
  assert.equal(snapshot.entries.some((entry) => /token/i.test(entry.snapshotRelative)), false);
  assert.equal(snapshot.exclusions.includes('os-vault-credentials'), true);
  const manifest = JSON.parse(await readFile(snapshot.manifestPath, 'utf8'));
  assert.equal(manifest.receiptSha256, snapshot.receiptSha256);
  assert.ok((await stat(snapshot.manifestPath)).isFile());
});

test('update preparation blocks active missions and otherwise returns a receipted snapshot reference', async () => {
  const blocked = new UpdatePreparationService({
    currentVersion: '5.0.0-beta.6',
    store: { listMissions: () => [{ id: 'mission_1', status: 'running' }] },
    snapshotService: { create: async () => { throw new Error('must not snapshot'); } },
    journal: { prepare: async () => { throw new Error('must not journal'); }, read: async () => null, markRuntimeReady: async () => null }
  });
  await assert.rejects(() => blocked.prepare({ targetVersion: '5.0.0-beta.7' }), (error) => error.statusCode === 409 && error.code === 'update_active_missions');

  const ready = new UpdatePreparationService({
    currentVersion: '5.0.0-beta.6',
    store: { listMissions: () => [{ id: 'mission_2', status: 'completed' }] },
    snapshotService: { create: async () => ({ snapshotId: 'snapshot_1', manifestPath: '/safe/snapshot-manifest.json', receiptSha256: 'a'.repeat(64), uncertifiedStores: ['capabilities.db'] }) },
    journal: { prepare: async () => ({ receiptSha256: 'b'.repeat(64) }), read: async () => null, markRuntimeReady: async () => null }
  });
  const result = await ready.prepare({ targetVersion: '5.0.0-beta.7' });
  assert.equal(result.prepared, true);
  assert.equal(result.snapshotReceiptSha256, 'a'.repeat(64));
  assert.equal(result.excludedCredentialMaterial, true);
});


test('migration journal records snapshot preparation and only marks the matching target runtime ready', async (t) => {
  const root = await rootFixture(t);
  let tick = 0;
  const journal = new UpdateMigrationJournal({ dataDir: root, clock: () => `2026-08-03T21:00:0${tick++}.000Z` });
  const prepared = await journal.prepare({
    fromVersion: '5.0.0-beta.6', toVersion: '5.0.0-beta.7',
    snapshot: { snapshotId: 'snapshot_1', manifestPath: path.join(root, 'updates', 'snapshots', 'snapshot_1', 'snapshot-manifest.json'), receiptSha256: 'c'.repeat(64) }
  });
  assert.equal(prepared.state, 'prepared');
  assert.equal(prepared.steps[0].state, 'completed');
  assert.equal(prepared.steps[1].state, 'pending');
  const mismatch = await journal.markRuntimeReady({ targetVersion: '5.0.0-beta.8' });
  assert.equal(mismatch.state, 'prepared');
  const ready = await journal.markRuntimeReady({ targetVersion: '5.0.0-beta.7' });
  assert.equal(ready.state, 'runtime-ready');
  assert.equal(ready.steps.find((step) => step.id === 'runtime-schema-open').state, 'completed');
  assert.match(ready.receiptSha256, /^[a-f0-9]{64}$/);
});

test('migration journal corruption fails closed instead of being silently replaced', async (t) => {
  const root = await rootFixture(t);
  const file = path.join(root, 'updates', 'migration-journal.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, '{bad json');
  const journal = new UpdateMigrationJournal({ dataDir: root });
  await assert.rejects(() => journal.prepare({ fromVersion: '5.0.0-beta.6', toVersion: '5.0.0-beta.7', snapshot: {} }), /JSON|Unexpected/i);
});
