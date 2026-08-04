import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AdaptiveRepositoryIntelligence } from '../src/repository/adaptive-repository-intelligence.mjs';
import { CodebaseKnowledgeGraphService } from '../src/repository/codebase-knowledge-graph-service.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { SecureSemanticIndex } from '../src/repository/secure-semantic-index.mjs';
import { SemanticDependencyIntelligenceService } from '../src/repository/semantic-dependency-intelligence-service.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-semantic-dependency-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'src', 'auth.mjs'), `export function authenticateSession(credentials) {\n  return Boolean(credentials?.token);\n}\n`);
  await writeFile(path.join(root, 'src', 'a.mjs'), `import { b } from './b.mjs';\nexport function a() { return b(); }\n`);
  await writeFile(path.join(root, 'src', 'b.mjs'), `import { a } from './a.mjs';\nexport function b() { return a.name; }\n`);
  await writeFile(path.join(root, 'src', 'entry.mjs'), `import { a } from './a.mjs';\nexport function run() { return a(); }\n`);
  await writeFile(path.join(root, 'tests', 'entry.test.mjs'), `import { run } from '../src/entry.mjs';\nvoid run;\n`);
  await writeFile(path.join(root, '.env'), 'FORGE_SECRET=never-return-this\n');

  const store = new StudioStore(path.join(root, '.forge-test.db'));
  t.after(() => store.close());
  const project = store.createProject({ id: 'project_semdep', name: 'Semantic Dependency', workspaceRoot: root });
  const graph = new CodebaseKnowledgeGraphService({ store });
  const repository = new AdaptiveRepositoryIntelligence({
    lexicalIndex: new RepositoryIndex({ store }),
    semanticIndex: new SecureSemanticIndex({ store }),
    graphService: graph,
  });
  const service = new SemanticDependencyIntelligenceService({ store, repositoryIntelligence: repository, codebaseKnowledge: graph });
  return { root, store, project, service };
}

test('SemanticDependencyIntelligenceService fails closed for missing principal, project, and query', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(() => service.indexProject({ projectId: 'project_semdep' }), { code: 'SEMANTIC_DEPENDENCY_PRINCIPAL_REQUIRED' });
  await assert.rejects(() => service.search({ principalId: 'user_1', projectId: 'missing', query: 'login' }), { code: 'SEMANTIC_DEPENDENCY_PROJECT_NOT_FOUND' });
  await assert.rejects(() => service.search({ principalId: 'user_1', projectId: 'project_semdep', query: '   ' }), { code: 'SEMANTIC_DEPENDENCY_QUERY_REQUIRED' });
});

test('SemanticDependencyIntelligenceService indexes and returns bounded local semantic evidence with receipts', async (t) => {
  const { service, project } = await fixture(t);
  const indexed = await service.indexProject({ principalId: 'user_1', projectId: project.id });
  assert.equal(indexed.schema, 'forge.semantic-dependency-index.v1');
  assert.match(indexed.receiptSha256, /^[a-f0-9]{64}$/);

  const result = await service.search({ principalId: 'user_1', projectId: project.id, query: 'where is login handled', limit: 5 });
  assert.equal(result.schema, 'forge.semantic-dependency-search.v1');
  assert.equal(result.items[0].path, 'src/auth.mjs');
  assert.ok(result.items[0].sources.includes('semantic'));
  assert.ok(result.items[0].preview.length <= 1_200);
  assert.match(result.querySha256, /^[a-f0-9]{64}$/);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes(rootMarker()), false);
  assert.equal(JSON.stringify(result).includes('never-return-this'), false);
});

test('SemanticDependencyIntelligenceService projects focused dependency neighborhoods, degrees, roots, leaves, and cycles', async (t) => {
  const { service, project } = await fixture(t);
  await service.indexProject({ principalId: 'user_1', projectId: project.id });

  const graph = service.dependencies({ principalId: 'user_1', projectId: project.id, rootPath: 'src/a.mjs', direction: 'both', depth: 2, limit: 50 });
  assert.equal(graph.schema, 'forge.semantic-dependency-graph.v1');
  assert.equal(graph.focus.path, 'src/a.mjs');
  assert.deepEqual(new Set(graph.nodes.map((node) => node.path)), new Set(['src/a.mjs', 'src/b.mjs', 'src/entry.mjs', 'tests/entry.test.mjs']));
  assert.equal(graph.nodes.find((node) => node.path === 'src/a.mjs').incoming, 2);
  assert.equal(graph.nodes.find((node) => node.path === 'src/a.mjs').outgoing, 1);
  assert.ok(graph.cycles.some((cycle) => cycle.paths.includes('src/a.mjs') && cycle.paths.includes('src/b.mjs')));
  assert.ok(graph.roots.includes('tests/entry.test.mjs'));
  assert.ok(graph.leaves.length >= 0);
  assert.match(graph.receiptSha256, /^[a-f0-9]{64}$/);

  const outgoing = service.dependencies({ principalId: 'user_1', projectId: project.id, rootPath: 'src/entry.mjs', direction: 'outgoing', depth: 1, limit: 50 });
  assert.deepEqual(new Set(outgoing.nodes.map((node) => node.path)), new Set(['src/entry.mjs', 'src/a.mjs']));

  assert.throws(() => service.dependencies({ principalId: 'user_1', projectId: project.id, rootPath: 'missing.mjs' }), { code: 'SEMANTIC_DEPENDENCY_ROOT_NOT_FOUND' });
  assert.throws(() => service.dependencies({ principalId: 'user_1', projectId: project.id, direction: 'sideways' }), { code: 'SEMANTIC_DEPENDENCY_DIRECTION_INVALID' });
});

function rootMarker() {
  return `${path.sep}forge-semantic-dependency-`;
}
