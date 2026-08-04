import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SqliteProjectStore } from '../src/storage/sqlite-project-store.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';

const owner = createPrincipal({ id: 'owner', type: 'human', roles: ['owner'], scopes: ['*'], trustDomain: 'test/tenant-a' });

test('SQLite project store is ACID across independent store instances and preserves the ProjectStore contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-sqlite-'));
  const file = path.join(root, 'forgeos.db');
  const first = new SqliteProjectStore(file, { snapshotLimit: 4 });
  const second = new SqliteProjectStore(file, { snapshotLimit: 4 });
  try {
    const project = await first.create({ name: 'SQLite production', principal: owner });
    const start = await first.read(project.id);
    const results = await Promise.allSettled([
      first.update(project.id, (current) => ({ ...current, metadata: { ...current.metadata, a: 1 } }), { expectedRevision: start.revision }),
      second.update(project.id, (current) => ({ ...current, metadata: { ...current.metadata, b: 1 } }), { expectedRevision: start.revision }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const after = await second.read(project.id);
    assert.equal(after.revision, 2);
    assert.equal((await first.list()).length, 1);
    assert.equal((await first.health()).ok, true);
    const snapshots = await first.listSnapshots(project.id);
    assert.equal(snapshots.length, 1);
    assert.equal((await first.verifySnapshot(project.id, snapshots[0].revision)).valid, true);
    const bundle = await first.exportBundle(project.id);
    assert.equal(bundle.projectId, project.id);
    assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
  } finally {
    first.close(); second.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('ForgeOrchestrator completes normal project mutations through SQLite backend', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-sqlite-orchestrator-'));
  const store = new SqliteProjectStore(path.join(root, 'forgeos.db'));
  try {
    const forge = new ForgeOrchestrator(store);
    const project = await forge.createProject({ name: 'Production project', domain: 'saas', assurance: 'A1' }, { principal: owner });
    const intent = await forge.recordIntent(project.id, { confirmed: true, goal: 'Ship safely', audience: 'operators', constraints: ['tenant isolation'], success: ['all gates pass'], nonGoals: [], preferredDomain: 'saas' });
    assert.equal(intent.revision, 2);
    assert.equal((await forge.getProject(project.id, { principal: owner })).intent.confirmed, true);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
