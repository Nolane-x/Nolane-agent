import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { BlobStore } from '../src/storage/blob-store.mjs';
import { EvidenceProviderRegistry, SkillRunEvidenceProvider } from '../src/evidence/providers.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-skill-run-'));
  const evidenceProviders=new EvidenceProviderRegistry({blobStore:new BlobStore(path.join(root,'.blobs'))});
  evidenceProviders.register(new SkillRunEvidenceProvider());
  const forge = new ForgeOrchestrator(new ProjectStore(root),{evidenceProviders});
  const project = await forge.createProject({ name: 'Skill run', assurance: 'A0' });
  const worker = createPrincipal({ id: 'worker-1', type: 'agent', roles: ['worker'], scopes: ['project:write','skill:run'] });
  await forge.recordIntent(project.id, { goal: 'Understand a real problem', audience: 'developers', constraints: ['evidence'], success: ['problem is verified'], nonGoals: [], confirmed: true });
  await forge.runCurrentGate(project.id);
  await forge.advance(project.id);
  return { forge, projectId: project.id, worker };
}

async function verifyRun(forge,projectId,run,artifactId,principal){
  const state=await forge.requestEvidence(projectId,{providerId:'skill-run-inspector',type:'skill-run-verification',title:'Skill run verification',subject:{skillRunId:run.id},metadata:{acceptedArtifactIds:[artifactId]}},{principal});
  return state.evidence.at(-1).id;
}

test('next action forwards tools and targets failed gate outputs without semantic mutation', async () => {
  const { forge, projectId } = await fixture();
  const before = await forge.getProject(projectId);
  const result = await forge.nextAction(projectId, { tools: ['web-search'] });
  const after = await forge.getProject(projectId);
  assert.equal(after.semanticRevision, before.semanticRevision);
  assert.ok(result.targets.includes('problem-discovery'));
  assert.ok(result.routes.length > 0);
  assert.ok(result.routes.some((route) => route.produces.includes('problem-discovery')));
});

test('skill run binds current inputs, worker, outputs, and semantic revision', async () => {
  const { forge, projectId, worker } = await fixture();
  const route = await forge.nextAction(projectId, { tools: ['web-search'] });
  const selected = route.routes.find((item) => item.produces.includes('problem-discovery'));
  const started = await forge.startSkillRun(projectId, selected.name, { principal: worker, tools: ['web-search'], targetOutputs: ['problem-discovery'] });
  assert.equal(started.run.status, 'running');
  assert.equal(started.run.principal.id, worker.id);
  assert.ok(started.run.expectedOutputs.includes('problem-discovery'));

  const saved = await forge.saveArtifact(projectId, {
    type: 'problem-discovery', title: 'Problem', content: { problem: 'Evidence is detached from delivery', evidencePacket: started.run.contractSnapshot.handoff.requiredEvidence },
    producedBy: { skill: selected.name }, consumes: [],
  }, { principal: worker, skillRunId: started.run.id });
  const artifactId = saved.artifacts.at(-1).id;
  const verificationEvidenceId=await verifyRun(forge,projectId,started.run,artifactId,worker);
  const completed = await forge.completeSkillRun(projectId, started.run.id, { artifactIds: [artifactId], verificationEvidenceId }, { principal: worker });
  assert.equal(completed.run.status, 'completed');
  assert.deepEqual(completed.run.artifactIds, [artifactId]);
});

test('skill run rejects missing tools, stale completion, and foreign worker', async () => {
  const { forge, projectId, worker } = await fixture();
  const routes = await forge.nextAction(projectId, { tools: ['web-search'] });
  const selected = routes.routes.find((item) => item.produces.includes('problem-discovery'));
  const started = await forge.startSkillRun(projectId, selected.name, { principal: worker, tools: ['web-search'], targetOutputs: ['problem-discovery'] });
  await forge.addFinding(projectId, { title: 'New blocker', severity: 'high', category: 'quality' }, { principal: worker });
  await assert.rejects(() => forge.completeSkillRun(projectId, started.run.id, { artifactIds: [] }, { principal: worker }), /stale|semantic revision/i);

  const other = createPrincipal({ id: 'worker-2', type: 'agent', roles: ['worker'], scopes: ['skill:run'] });
  await assert.rejects(() => forge.failSkillRun(projectId, started.run.id, 'Cannot continue', { principal: other }), /principal|worker/i);
});


test('completed skill run does not accept worker-reported utility', async () => {
  const { forge, projectId, worker } = await fixture();
  const route = await forge.nextAction(projectId, { tools: ['web-search'] });
  const selected = route.routes.find((item) => item.produces.includes('problem-discovery'));
  const started = await forge.startSkillRun(projectId, selected.name, { principal: worker, tools: ['web-search'], targetOutputs: ['problem-discovery'] });
  const saved = await forge.saveArtifact(projectId, {
    type: 'problem-discovery', title: 'Problem', content: { problem: 'Unverified product state', evidencePacket: started.run.contractSnapshot.handoff.requiredEvidence },
    producedBy: { skill: selected.name }, consumes: [],
  }, { principal: worker, skillRunId: started.run.id });
  const artifactId = saved.artifacts.at(-1).id;
  const verificationEvidenceId=await verifyRun(forge,projectId,started.run,artifactId,worker);
  await assert.rejects(()=>forge.completeSkillRun(projectId,started.run.id,{artifactIds:[artifactId],verificationEvidenceId,metrics:{passed:true,qualityDelta:12,tokenDelta:2400,evaluationRunSha256:'a'.repeat(64)}},{principal:worker}),/self-report|trusted evaluation/i);
  assert.equal((await forge.getProject(projectId)).skillUtility[selected.name],undefined);
});
