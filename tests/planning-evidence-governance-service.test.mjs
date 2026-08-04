import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { PlanningEvidenceGovernanceService } from '../src/orchestration/planning-evidence-governance-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-planning-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'src', 'router.mjs'), 'export function route(input) { return input; }\n');
  await writeFile(path.join(root, 'tests', 'router.test.mjs'), 'test("route", () => {});\n');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  await writeFile(path.join(root, 'eslint.config.mjs'), 'export default [];\n');
  await writeFile(path.join(root, 'docs', 'architecture.md'), '# Router architecture\nThe router selects providers.\n');
  const store = new StudioStore(path.join(root, '.forge', 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Planning fixture', workspaceRoot: root });
  const repositoryIndex = new RepositoryIndex({ store });
  const service = new PlanningEvidenceGovernanceService({ store, repositoryIndex, maxSteps: 12, maxEvidencePerKind: 8 });
  return { root, store, project, repositoryIndex, service };
}

const plan = {
  summary: 'Inspect, change, and verify the router.',
  tasks: [
    { id: 'scout', title: 'Inspect router', objective: 'Inspect router implementation and related evidence.', role: 'scout', dependencies: [], allowedPaths: ['src/**', 'tests/**', 'docs/**'], deniedPaths: ['.env'] },
    { id: 'builder', title: 'Patch router', objective: 'Update router behavior while preserving provider selection.', role: 'builder', dependencies: ['scout'], allowedPaths: ['src/router.mjs'], deniedPaths: ['.env'] },
    { id: 'reviewer', title: 'Verify router', objective: 'Review the router diff and run related tests.', role: 'reviewer', dependencies: ['builder'], allowedPaths: ['src/**', 'tests/**'], deniedPaths: ['.env'] },
  ],
};

test('preflight detects missing information and creates a bounded user input request', async (t) => {
  const { project, service } = await fixture(t);
  const result = await service.preflight({ projectId: project.id, objective: 'Fix it somehow TODO' });
  assert.equal(result.status, 'needs-input');
  assert.ok(result.missingInformation.some((item) => item.code === 'OBJECTIVE_AMBIGUOUS'));
  assert.equal(result.inputRequest.required, true);
  assert.match(result.inputRequest.question, /outcome|kết quả|specific/i);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.evidence.tests.some((item) => item.path === 'tests/router.test.mjs'), true);
  assert.equal(result.evidence.configs.some((item) => item.path === 'package.json'), true);
  assert.equal(result.evidence.docs.some((item) => item.path === 'docs/architecture.md'), true);
});

test('preflight estimates scope and summarizes related test config documentation and source evidence', async (t) => {
  const { project, service } = await fixture(t);
  const result = await service.preflight({ projectId: project.id, objective: 'Update router provider selection and verify the behavior' });
  assert.equal(result.status, 'ready');
  assert.ok(['small', 'medium', 'large'].includes(result.scope.band));
  assert.equal(result.scope.estimatedFiles.min >= 1, true);
  assert.equal(result.summary.tests >= 1, true);
  assert.equal(result.summary.configs >= 1, true);
  assert.equal(result.summary.docs >= 1, true);
  assert.equal(result.summary.sources >= 1, true);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('enrichPlan attaches step risk expected files tools subagents and evidence without file contents', async (t) => {
  const { project, service } = await fixture(t);
  const preflight = await service.preflight({ projectId: project.id, objective: 'Update router provider selection and verify the behavior' });
  const enriched = service.enrichPlan({ preflight, plan });
  assert.equal(enriched.tasks.length, 3);
  const builder = enriched.tasks.find((item) => item.id === 'builder');
  assert.equal(builder.expectedFiles.includes('src/router.mjs'), true);
  assert.equal(builder.requiredTools.includes('fs.patchSet'), true);
  assert.equal(builder.requiredTools.includes('test.run'), true);
  assert.equal(builder.risk.level === 'medium' || builder.risk.level === 'high', true);
  assert.equal(builder.subagent.required, false);
  const reviewer = enriched.tasks.find((item) => item.id === 'reviewer');
  assert.equal(reviewer.subagent.required, true);
  assert.equal(reviewer.subagent.role, 'reviewer');
  assert.equal(JSON.stringify(enriched).includes('export function route'), false);
  assert.match(enriched.receiptSha256, /^[a-f0-9]{64}$/);
});

test('enrichPlan rejects vague and over-detailed plans instead of inventing execution details', async (t) => {
  const { project, service } = await fixture(t);
  const preflight = await service.preflight({ projectId: project.id, objective: 'Update router provider selection and verify the behavior' });
  assert.throws(() => service.enrichPlan({ preflight, plan: { summary: 'vague', tasks: [{ id: 'x', title: 'Do it', objective: 'Do it', role: 'builder', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] } }), /ambiguous|vague/i);
  const tasks = Array.from({ length: 13 }, (_, index) => ({ id: `s${index}`, title: `Inspect unit ${index}`, objective: `Inspect unit ${index} and record evidence.`, role: 'scout', dependencies: [], allowedPaths: ['src/**'], deniedPaths: [] }));
  assert.throws(() => service.enrichPlan({ preflight, plan: { summary: 'too detailed', tasks } }), /12|detail/i);
});

test('recordRevision requires a reason and persists an immutable plan-change receipt', async (t) => {
  const { project, service, store } = await fixture(t);
  const preflight = await service.preflight({ projectId: project.id, objective: 'Update router provider selection and verify the behavior' });
  const current = service.enrichPlan({ preflight, plan });
  assert.throws(() => service.recordRevision({ projectId: project.id, previousPlan: current, nextPlan: current, reason: '' }), /reason/i);
  const nextPlan = { ...current, summary: 'Inspect, patch, verify, and document router behavior.' };
  const revision = service.recordRevision({ projectId: project.id, previousPlan: current, nextPlan, reason: 'New documentation evidence changed the verification scope.' });
  assert.equal(revision.reason.includes('documentation'), true);
  assert.match(revision.receiptSha256, /^[a-f0-9]{64}$/);
  const event = store.listEvents().find((item) => item.type === 'planning.plan.revised');
  assert.equal(event.payload.reason, revision.reason);
  assert.equal(event.payload.receiptSha256, revision.receiptSha256);
});

test('preflight works through an adaptive repository facade without depending on facade internals', async (t) => {
  const { project, store, repositoryIndex } = await fixture(t);
  const adaptiveFacade = {
    async index(targetProject) {
      return repositoryIndex.index(targetProject);
    },
    async search(projectId, query, options) {
      return {
        schema: 'forge.adaptive-repository-search.v1',
        items: repositoryIndex.search(projectId, query, options),
      };
    },
  };
  const service = new PlanningEvidenceGovernanceService({ store, repositoryIndex: adaptiveFacade });
  const result = await service.preflight({
    projectId: project.id,
    objective: 'Update router provider selection and verify the behavior',
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.evidence.sources.some((item) => item.path === 'src/router.mjs'), true);
  assert.equal(result.evidence.tests.some((item) => item.path === 'tests/router.test.mjs'), true);
});
