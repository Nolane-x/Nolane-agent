import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { RepositoryDigitalTwinService } from '../src/repository/repository-digital-twin-service.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { SecureSemanticIndex } from '../src/repository/secure-semantic-index.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-digital-twin-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(path.join(root, 'src', 'auth.mjs'), 'export function validateSession(token) { return Boolean(token); }\n');
  await writeFile(path.join(root, 'tests', 'auth.test.mjs'), "import { validateSession } from '../src/auth.mjs';\nassert.equal(validateSession('x'), true);\n");
  await writeFile(path.join(root, 'config', 'app.json'), '{"sessionTtl":60}\n');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'twin-fixture', scripts: { build: 'node build.mjs', test: 'node --test' }, dependencies: { zod: '^4.0.0' } }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const project = store.createProject({ id: 'twin_project', name: 'Twin', workspaceRoot: root });
  await new RepositoryIndex({ store }).index(project);
  await new SecureSemanticIndex({ store }).index(project, { deferEmbeddings: true, branchContext: { branch: 'feature/twin', headSha: 'a'.repeat(40), dirtyHash: 'clean' } });
  return { root, store, project };
}

test('RepositoryDigitalTwinService emits cited repository, symbol, test, build, config, and dependency relations', async (t) => {
  const { store, project } = await fixture(t);
  const service = new RepositoryDigitalTwinService({ store });
  const twin = service.build(project.id, { branchContext: { branch: 'feature/twin', headSha: 'a'.repeat(40), dirtyHash: 'clean' } });
  assert.equal(twin.schema, 'forge.repository-digital-twin.v2');
  assert.equal(twin.branch.branch, 'feature/twin');
  assert.ok(twin.nodes.some((node) => node.kind === 'workspace'));
  assert.ok(twin.nodes.some((node) => node.kind === 'symbol' && node.name === 'validateSession'));
  assert.ok(twin.nodes.some((node) => node.kind === 'test'));
  assert.ok(twin.nodes.some((node) => node.kind === 'config'));
  assert.ok(twin.nodes.some((node) => node.kind === 'build-target' && node.name === 'build'));
  assert.ok(twin.nodes.some((node) => node.kind === 'external-dependency' && node.name === 'zod'));
  const verifies = twin.edges.find((edge) => edge.kind === 'verifies');
  assert.ok(verifies);
  assert.match(verifies.citation.sourceHash, /^[a-f0-9]{64}$/);
  assert.ok(twin.edges.some((edge) => edge.kind === 'imports'));
  assert.ok(twin.edges.some((edge) => edge.kind === 'configures'));
  assert.ok(twin.edges.some((edge) => edge.kind === 'declares'));
  assert.ok(twin.unknowns.includes('runtime-observation-unavailable'));
  assert.match(twin.twinSha256, /^[a-f0-9]{64}$/);
});

test('RepositoryDigitalTwinService is bounded and changes its hash after source reindex', async (t) => {
  const { root, store, project } = await fixture(t);
  const service = new RepositoryDigitalTwinService({ store });
  const before = service.build(project.id, { maxNodes: 200, maxEdges: 400 });
  const bounded = service.build(project.id, { maxNodes: 3, maxEdges: 2 });
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.nodes.length <= 3, true);
  assert.equal(bounded.edges.length <= 2, true);

  await writeFile(path.join(root, 'src', 'auth.mjs'), 'export function validateSession(token) { return token?.active === true; }\n');
  await new RepositoryIndex({ store }).index(project);
  const after = service.build(project.id, { maxNodes: 200, maxEdges: 400 });
  assert.notEqual(after.twinSha256, before.twinSha256);
});
