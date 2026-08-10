import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { RepositoryDigitalTwinService } from '../src/repository/repository-digital-twin-service.mjs';
import { createRepositoryIntelligenceFabric } from '../src/repository/repository-intelligence-fabric.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { RepositoryWorkspaceStateAdapter } from '../src/repository/repository-workspace-state-adapter.mjs';
import { SecureSemanticIndex } from '../src/repository/secure-semantic-index.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-truth-plane-'));
  await mkdir(path.join(root, 'src', 'api'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await mkdir(path.join(root, 'config'), { recursive: true });
  const source = 'export function validateSession(token) { return Boolean(token); }\n';
  await writeFile(path.join(root, 'src', 'api', 'auth.mjs'), source);
  await writeFile(path.join(root, 'tests', 'auth.test.mjs'), "import { validateSession } from '../src/api/auth.mjs';\nvalidateSession('x');\n");
  await writeFile(path.join(root, 'config', 'app.json'), '{"sessionTtl":60}\n');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'truth-fixture', scripts: { build: 'node build.mjs', test: 'node --test' }, dependencies: { zod: '^4.0.0' } }));
  execFileSync('git', ['init', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'truth@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Truth Fixture'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'baseline'], { cwd: root });
  execFileSync('git', ['checkout', '-b', 'feature/truth'], { cwd: root });
  await writeFile(path.join(root, 'config', 'app.json'), '{"sessionTtl":120}\n');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ id: 'truth_project', name: 'Truth', workspaceRoot: root });
  await new RepositoryIndex({ store }).index(project);
  await new SecureSemanticIndex({ store }).index(project, { deferEmbeddings: true });
  return { root, store, project, source };
}

test('RepositoryWorkspaceStateAdapter reads real branch, worktree, uncommitted changes, and unsaved overlays', async (t) => {
  const { root } = await fixture(t);
  const overlayContent = 'export function validateSession(token) { return token?.active === true; }\n';
  const state = new RepositoryWorkspaceStateAdapter().inspect(root, {
    editorOverlays: [{ path: 'src/api/auth.mjs', content: overlayContent, sha256: sha(overlayContent), overlayId: 'editor:src/api/auth.mjs' }],
  });
  assert.equal(state.available, true);
  assert.equal(state.branch, 'feature/truth');
  assert.equal(state.worktree, root.replaceAll('\\', '/'));
  assert.match(state.headSha, /^[a-f0-9]{40}$/);
  assert.match(state.dirtyHash, /^[a-f0-9]{64}$/);
  assert.ok(state.uncommittedChanges.some((item) => item.path === 'config/app.json'));
  assert.match(state.editorOverlayHash, /^[a-f0-9]{64}$/);
  assert.equal(state.editorOverlays[0].overlayId, 'editor:src/api/auth.mjs');
});

test('RepositoryDigitalTwinService v2 builds cited truth maps from real indexed source and observed providers', async (t) => {
  const { root, store, project } = await fixture(t);
  const overlayContent = 'export function validateSession(token) { return token?.active === true; }\n';
  const overlay = { path: 'src/api/auth.mjs', content: overlayContent, sha256: sha(overlayContent), overlayId: 'editor:src/api/auth.mjs' };
  const sourceHash = sha(await readFile(path.join(root, 'src', 'api', 'auth.mjs')));
  const runtimeHash = '9'.repeat(64);
  const service = new RepositoryDigitalTwinService({ store });
  const twin = service.build(project.id, {
    editorOverlays: [overlay],
    relationshipProvider: { edges: () => [{ kind: 'calls', from: 'symbol:validateSession', to: 'service:auth', citation: { path: 'src/api/auth.mjs', line: 1, sourceHash }, confidence: 'ast' }] },
    runtimeProvider: { snapshot: () => ({ edges: [{ kind: 'request', from: 'request:GET /session', to: 'service:auth', citation: { path: 'runtime/auth.ndjson', line: 1, sourceHash: runtimeHash }, confidence: 'runtime-observed' }] }) },
  });
  assert.equal(twin.schema, 'forge.repository-digital-twin.v2');
  assert.equal(twin.legacySchema, 'forge.repository-digital-twin.v1');
  assert.equal(twin.branch.branch, 'feature/truth');
  assert.equal(twin.branch.worktree, root.replaceAll('\\', '/'));
  assert.ok(twin.branch.uncommittedChanges.some((item) => item.path === 'config/app.json'));
  assert.equal(twin.truthContext.editorOverlayCount, 1);
  assert.ok(twin.architecture.nodes.some((node) => node.kind === 'public-api'));
  assert.ok(twin.symbols.nodes.some((node) => node.citation?.overlayId === 'editor:src/api/auth.mjs'));
  assert.ok(twin.runtime.edges.some((edge) => edge.kind === 'request'));
  assert.match(twin.truthReceiptSha256, /^[a-f0-9]{64}$/);
});

test('RepositoryDigitalTwinService queries in staged order, pages zoom results, and invalidates drifted or cross-branch facts', async (t) => {
  const { root, store, project } = await fixture(t);
  const service = new RepositoryDigitalTwinService({ store });
  const twin = service.build(project.id);
  const query = await service.query(project.id, { query: 'validateSession', budget: 30, stopWhen: { minCitedResults: 2 } });
  assert.deepEqual(query.stages.slice(0, 2).map((stage) => stage.id), ['exact', 'lexical']);
  assert.ok(query.citedResults.length >= 2);
  const first = service.zoom(project.id, { level: 'symbol', limit: 1 });
  assert.equal(first.loadedNodeCount, 1);
  assert.equal(first.loadedNodeCount < first.graphTotalNodeCount, true);
  await writeFile(path.join(root, 'src', 'api', 'auth.mjs'), 'export function validateSession() { return false; }\n');
  const drift = service.validateFacts(project.id, twin.branch);
  assert.ok(drift.invalid.some((item) => item.reason === 'source-hash-mismatch'));
  const crossBranch = service.validateFacts(project.id, { ...twin.branch, branch: 'main' });
  assert.ok(crossBranch.invalid.some((item) => item.reason === 'branch-context-mismatch'));
});

test('Repository Intelligence Fabric keeps Truth Plane unloaded on lexical fast path and loads it on demand', async (t) => {
  const { store, project } = await fixture(t);
  const governor = { policy: () => ({ semanticIndexing: 'suspended' }), snapshot: () => ({ state: 'normal', policy: { semanticIndexing: 'suspended' } }) };
  const fabric = createRepositoryIntelligenceFabric({ store, governor });
  t.after(() => fabric.close());
  await fabric.lexicalSearch(project.id, 'validateSession');
  assert.equal(fabric.repositoryTruthStatus().loaded, false);
  const twin = fabric.repositoryTruth(project.id);
  assert.equal(twin.schema, 'forge.repository-digital-twin.v2');
  assert.equal(fabric.repositoryTruthStatus().loaded, true);
  const zoom = fabric.zoomRepositoryTruth(project.id, { level: 'workspace' });
  assert.equal(zoom.loadedNodeCount, 1);
});
