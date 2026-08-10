import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectStore } from '../src/storage/project-store-factory.mjs';
import { ProjectStore } from '../src/core/project-store.mjs';
import { SqliteProjectStore } from '../src/storage/sqlite-project-store.mjs';

test('project store factory selects explicit portable JSON or transactional SQLite backend', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-store-factory-'));
  const json = createProjectStore({ backend: 'json', dataDir: root });
  const sqlite = createProjectStore({ backend: 'sqlite', dataDir: root });
  try {
    assert.ok(json instanceof ProjectStore);
    assert.ok(sqlite instanceof SqliteProjectStore);
    assert.match(sqlite.file, /forgeos\.sqlite$/);
  } finally {
    sqlite.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('project store factory rejects unknown backends instead of silently falling back', () => {
  assert.throws(() => createProjectStore({ backend: 'memory' }), /Unsupported project storage backend/);
});
