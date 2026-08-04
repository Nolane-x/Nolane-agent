import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore, RevisionConflictError } from '../src/core/project-store.mjs';

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('three overlapping updates are serialized without lost writes', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-race-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const project = await store.create({ name: 'Race' });
  const aEntered = deferred(); const allowA = deferred();
  const bEntered = deferred(); const allowB = deferred();

  const a = store.update(project.id, async (state) => {
    aEntered.resolve(); await allowA.promise;
    state.history.push({ type: 'A' }); return state;
  });
  await aEntered.promise;
  const b = store.update(project.id, async (state) => {
    bEntered.resolve(); await allowB.promise;
    state.history.push({ type: 'B' }); return state;
  });
  allowA.resolve(); await bEntered.promise;
  const c = store.update(project.id, async (state) => {
    state.history.push({ type: 'C' }); return state;
  });
  allowB.resolve();
  await Promise.all([a, b, c]);
  const types = (await store.read(project.id)).history.map((event) => event.type);
  assert.ok(types.includes('A'));
  assert.ok(types.includes('B'));
  assert.ok(types.includes('C'));
});

test('optimistic revision conflicts are detected instead of overwritten', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-cas-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const project = await store.create({ name: 'CAS' });
  await store.update(project.id, (state) => ({ ...state, name: 'newer' }));
  await assert.rejects(
    () => store.update(project.id, (state) => ({ ...state, name: 'stale' }), { expectedRevision: project.revision }),
    RevisionConflictError,
  );
  assert.equal((await store.read(project.id)).name, 'newer');
});

test('read migrates schema v2 through the v4 trust-kernel chain and validates aggregate invariants', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-migrate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const project = await store.create({ name: 'Modern' });
  const file = path.join(dir, `${project.id}.json`);
  const legacy = JSON.parse(await readFile(file, 'utf8'));
  legacy.schemaVersion = 2;
  delete legacy.revision;
  delete legacy.semanticRevision;
  delete legacy.pendingApprovals;
  delete legacy.skillRuns;
  await writeFile(file, JSON.stringify(legacy));
  const migrated = await store.read(project.id);
  assert.equal(migrated.schemaVersion, 5);
  assert.ok(Number.isInteger(migrated.revision));
  assert.ok(Number.isInteger(migrated.semanticRevision));
  assert.ok(Array.isArray(migrated.pendingApprovals));
  assert.ok(Array.isArray(migrated.skillRuns));
});

test('list isolates corrupt projects instead of failing the whole workspace', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-corrupt-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const valid = await store.create({ name: 'Valid' });
  await writeFile(path.join(dir, 'forge_corrupt.json'), '{broken', 'utf8');
  const projects = await store.list();
  assert.deepEqual(projects.map((item) => item.id), [valid.id]);
  const diagnostics = store.diagnostics();
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].file, /forge_corrupt/);
});

test('export returns a portable content-addressed bundle, not a server path', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-export-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const project = await store.create({ name: 'Export' });
  const bundle = await store.exportBundle(project.id);
  assert.equal(bundle.fileName, `${project.id}.forge.json`);
  assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(bundle.content).id, project.id);
  assert.equal('destination' in bundle, false);
});
