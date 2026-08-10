import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { CodebaseKnowledgeGraphService } from '../src/repository/codebase-knowledge-graph-service.mjs';
import { CodeRelationshipIntelligenceService } from '../src/repository/code-relationship-intelligence-service.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const execFileAsync = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-code-relationships-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'src', 'base.ts'), `export class BaseService {}\nexport interface Auditable {}\nexport class Duplicate {}\n`);
  await writeFile(path.join(root, 'src', 'other.ts'), `export class Duplicate {}\n`);
  await writeFile(path.join(root, 'src', 'feature.ts'), `import { BaseService as Parent, Auditable } from './base';\n// Fixes #12 and documents issue ABC-77. Bare 12345 is not an issue.\nexport class FeatureService extends Parent implements Auditable {}\nexport class ExternalFeature extends ExternalBase {}\nexport class AmbiguousFeature extends Duplicate {}\n`);
  await writeFile(path.join(root, 'src', 'local.ts'), `class LocalBase {}\nexport class LocalChild extends LocalBase {}\n`);
  await writeFile(path.join(root, 'docs', 'decisions.md'), `Related issue owner/repo#33. Ref GH-9.\n`);

  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'initial relationship fixtures'], { cwd: root });
  await writeFile(path.join(root, 'src', 'feature.ts'), `import { BaseService as Parent, Auditable } from './base';\n// Fixes #12 and documents issue ABC-77. Bare 12345 is not an issue.\nexport class FeatureService extends Parent implements Auditable { enabled = true; }\nexport class ExternalFeature extends ExternalBase {}\nexport class AmbiguousFeature extends Duplicate {}\n`);
  await execFileAsync('git', ['add', 'src/feature.ts'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'Fixes GH-42 and closes owner/repo#91'], { cwd: root });

  const store = new StudioStore(path.join(root, '.forge-test.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ id: 'project_relationships', name: 'Relationships', workspaceRoot: root });
  const graph = new CodebaseKnowledgeGraphService({ store, maxFiles: 100 });
  const service = new CodeRelationshipIntelligenceService({ store, codebaseKnowledge: graph, now: () => '2026-07-29T00:00:00.000Z' });
  return { root, store, project, service };
}

test('fails closed for missing principal, unknown project, and invalid query bounds', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(() => service.indexProject({ projectId: 'project_relationships' }), { code: 'CODE_RELATIONSHIP_PRINCIPAL_REQUIRED' });
  assert.throws(() => service.inheritance({ principalId: 'user_1', projectId: 'missing' }), { code: 'CODE_RELATIONSHIP_PROJECT_NOT_FOUND' });
  assert.throws(() => service.issues({ principalId: 'user_1', projectId: 'project_relationships', limit: 0 }), { code: 'CODE_RELATIONSHIP_LIMIT_INVALID' });
});

test('indexes compiler-backed inheritance with alias imports, same-file bases, and explicit unresolved evidence', async (t) => {
  const { project, service } = await fixture(t);
  const indexed = await service.indexProject({ principalId: 'user_1', projectId: project.id });
  assert.equal(indexed.schema, 'forge.code-relationship-index.v1');
  assert.equal(indexed.compiler, 'typescript@5.8.3');
  assert.equal(indexed.inheritance.resolved, 3);
  assert.equal(indexed.inheritance.unresolved, 2);
  assert.match(indexed.graphSha256, /^[a-f0-9]{64}$/);
  assert.match(indexed.receiptSha256, /^[a-f0-9]{64}$/);

  const graph = service.inheritance({ principalId: 'user_1', projectId: project.id, root: 'FeatureService', direction: 'ancestors', depth: 3, limit: 50 });
  assert.equal(graph.schema, 'forge.inheritance-graph.v1');
  assert.deepEqual(new Set(graph.nodes.map((node) => node.name)), new Set(['FeatureService', 'BaseService', 'Auditable']));
  assert.ok(graph.edges.some((edge) => edge.relation === 'extends' && edge.childName === 'FeatureService' && edge.parentName === 'BaseService' && edge.resolution === 'relative-import'));
  assert.ok(graph.edges.some((edge) => edge.relation === 'implements' && edge.parentName === 'Auditable'));
  assert.ok(graph.edges.every((edge) => edge.detector === 'typescript-heritage-clause'));
  assert.match(graph.receiptSha256, /^[a-f0-9]{64}$/);

  const unresolved = service.inheritance({ principalId: 'user_1', projectId: project.id, root: 'ExternalFeature', direction: 'both', depth: 1, limit: 50 });
  assert.equal(unresolved.unresolved[0].parentName, 'ExternalBase');
  assert.equal(unresolved.unresolved[0].reason, 'not-found');

  const ambiguous = service.inheritance({ principalId: 'user_1', projectId: project.id, root: 'AmbiguousFeature', direction: 'both', depth: 1, limit: 50 });
  assert.equal(ambiguous.unresolved[0].reason, 'ambiguous');
});

test('indexes only contextual local issue references and maps commit references to changed files', async (t) => {
  const { root, project, service } = await fixture(t);
  await service.indexProject({ principalId: 'user_1', projectId: project.id });
  const result = service.issues({ principalId: 'user_1', projectId: project.id, limit: 100 });
  assert.equal(result.schema, 'forge.issue-code-index.v1');
  assert.deepEqual(new Set(result.issues.map((issue) => issue.key)), new Set(['#12', 'ABC-77', 'GH-9', 'GH-42', 'owner/repo#33', 'owner/repo#91']));
  assert.equal(JSON.stringify(result).includes('12345'), false);
  assert.ok(result.links.some((link) => link.issueKey === '#12' && link.path === 'src/feature.ts' && link.line === 2 && link.detector === 'contextual-source-reference'));
  assert.ok(result.links.some((link) => link.issueKey === 'GH-42' && link.path === 'src/feature.ts' && /^[a-f0-9]{40}$/.test(link.commitHash) && link.detector === 'git-commit-reference'));
  assert.ok(result.links.some((link) => link.issueKey === 'owner/repo#91' && link.path === 'src/feature.ts'));
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.match(result.graphSha256, /^[a-f0-9]{64}$/);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('supports bounded issue/path filters and deterministic relationship hashes across no-op reindex', async (t) => {
  const { project, service } = await fixture(t);
  const first = await service.indexProject({ principalId: 'user_1', projectId: project.id });
  const second = await service.indexProject({ principalId: 'user_1', projectId: project.id });
  assert.equal(second.graphSha256, first.graphSha256);
  const filtered = service.issues({ principalId: 'user_1', projectId: project.id, issueKey: 'GH-42', pathPrefix: 'src/', limit: 1 });
  assert.deepEqual(filtered.issues.map((issue) => issue.key), ['GH-42']);
  assert.equal(filtered.links.length, 1);
  assert.equal(filtered.links[0].path, 'src/feature.ts');
  assert.throws(() => service.inheritance({ principalId: 'user_1', projectId: project.id, root: 'MissingClass' }), { code: 'CODE_RELATIONSHIP_ROOT_NOT_FOUND' });
});
