import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { callForgeTool } from '../src/server/tool-registry.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-access-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const forge = new ForgeOrchestrator(new ProjectStore(root));
  const owner = createPrincipal({ id: 'human:owner', type: 'human', roles: ['owner'], scopes: ['*'], trustDomain: 'org:alpha' });
  const outsider = createPrincipal({ id: 'agent:outsider', type: 'agent', roles: ['worker'], scopes: ['*'], trustDomain: 'org:beta' });
  const reviewer = createPrincipal({ id: 'human:reviewer', type: 'human', roles: ['reviewer'], scopes: ['*'], trustDomain: 'org:alpha' });
  return { forge, owner, outsider, reviewer };
}

test('project owner is bound at creation and outsiders cannot read, list, mutate, or export', async (t) => {
  const { forge, owner, outsider } = await fixture(t);
  const created = await callForgeTool('forge_project_create', { name: 'Private project', domain: 'saas', assurance: 'A1' }, forge, { principal: owner });
  const projectId = created.project.id;
  assert.equal(created.project.access.ownerPrincipalId, owner.id);

  await assert.rejects(() => callForgeTool('forge_project_get', { projectId }, forge, { principal: outsider }), /Project access denied/);
  const listed = await callForgeTool('forge_project_list', {}, forge, { principal: outsider });
  assert.deepEqual(listed.projects, []);
  await assert.rejects(() => callForgeTool('forge_intent_record', { projectId, intent: { goal: 'x', audience: 'y', success: ['z'], confirmed: true } }, forge, { principal: outsider }), /Project access denied/);
  await assert.rejects(() => callForgeTool('forge_project_export', { projectId }, forge, { principal: outsider }), /Project access denied/);
});

test('owner can grant scoped reviewer access without granting write or release capabilities', async (t) => {
  const { forge, owner, reviewer } = await fixture(t);
  const { project } = await callForgeTool('forge_project_create', { name: 'Scoped project', domain: 'saas', assurance: 'A1' }, forge, { principal: owner });
  await forge.grantProjectAccess(project.id, { principalId: reviewer.id, trustDomain: reviewer.trustDomain, capabilities: ['read', 'review'] }, { principal: owner });

  const visible = await callForgeTool('forge_project_get', { projectId: project.id }, forge, { principal: reviewer });
  assert.equal(visible.project.id, project.id);
  await assert.rejects(() => callForgeTool('forge_intent_record', { projectId: project.id, intent: { goal: 'x', audience: 'y', success: ['z'], confirmed: true } }, forge, { principal: reviewer }), /Project capability write is required/);
  await assert.rejects(() => callForgeTool('forge_gate_run', { projectId: project.id }, forge, { principal: reviewer }), /Project capability write is required/);
  await assert.rejects(() => callForgeTool('forge_skills_route', { projectId: project.id }, forge, { principal: reviewer }), /Project capability write is required/);
  await assert.rejects(() => callForgeTool('forge_next_action', { projectId: project.id }, forge, { principal: reviewer }), /Project capability write is required/);
});

test('legacy schema v4 projects migrate to schema v5 with system-owned access', async (t) => {
  const { forge } = await fixture(t);
  const project = await forge.createProject({ name: 'Migration seed' });
  assert.equal(project.schemaVersion, 5);
  assert.equal(project.access.ownerPrincipalId, 'forgeos-system');
});
