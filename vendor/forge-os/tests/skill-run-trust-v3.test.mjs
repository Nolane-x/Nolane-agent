import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { BlobStore } from '../src/storage/blob-store.mjs';
import { CommandEvidenceProvider, EvidenceProviderRegistry, SkillRunEvidenceProvider } from '../src/evidence/providers.mjs';

async function setup(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-skill-trust-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const registry=new EvidenceProviderRegistry({blobStore:new BlobStore(path.join(root,'.blobs'))});
  registry.register(new CommandEvidenceProvider({id:'artifact-check',recipes:{pass:{evidenceTypes:['artifact-verification'],command:[process.execPath,'-e','process.exit(0)']}}}));
  registry.register(new SkillRunEvidenceProvider());
  const forge=new ForgeOrchestrator(new ProjectStore(root),{evidenceProviders:registry});
  const worker=createPrincipal({id:'agent:worker-1',type:'agent',roles:['worker'],scopes:['project:write','skill:run'],trustDomain:'team:delivery'});
  const reviewer=createPrincipal({id:'human:reviewer-1',type:'human',roles:['artifact-reviewer','artifact-verifier'],scopes:['project:write'],trustDomain:'team:quality'});
  const project=await forge.createProject({name:'Skill trust',assurance:'A2'});
  await forge.recordIntent(project.id,{goal:'Verify a product problem',audience:'developers',constraints:['evidence'],success:['problem is verified'],nonGoals:[],confirmed:true});
  await forge.runCurrentGate(project.id);await forge.advance(project.id);
  const route=await forge.nextAction(project.id,{tools:['web-search']});
  const selected=route.routes.find((item)=>item.produces.includes('problem-discovery'));
  return {root,forge,projectId:project.id,worker,reviewer,selected};
}

async function publishReviewedOutput(ctx){
  const started=await ctx.forge.startSkillRun(ctx.projectId,ctx.selected.name,{principal:ctx.worker,tools:['web-search'],targetOutputs:['problem-discovery']});
  const required=started.run.contractSnapshot.handoff.requiredEvidence;
  let state=await ctx.forge.saveArtifact(ctx.projectId,{type:'problem-discovery',title:'Verified problem',content:{problem:'Evidence is detached from delivery',evidencePacket:required},producedBy:{skill:ctx.selected.name},consumes:[]},{principal:ctx.worker,skillRunId:started.run.id});
  const artifact=state.artifacts.at(-1);
  state=await ctx.forge.reviewArtifact(ctx.projectId,artifact.id,{notes:'Independent review completed.'},{principal:ctx.reviewer});
  const reviewed=state.artifacts.find((item)=>item.id===artifact.id);
  state=await ctx.forge.requestEvidence(ctx.projectId,{providerId:'artifact-check',recipeId:'pass',type:'artifact-verification',title:'Artifact verification',subject:{artifactId:reviewed.id,artifactSha256:reviewed.sha256}},{principal:ctx.reviewer});
  const artifactEvidence=state.evidence.at(-1);
  state=await ctx.forge.verifyArtifact(ctx.projectId,artifact.id,{evidence:[artifactEvidence.id]},{principal:ctx.reviewer});
  return {started,artifact:state.artifacts.find((item)=>item.id===artifact.id)};
}

test('skill run completion requires a trusted run-bound contract receipt',async(t)=>{
  const ctx=await setup(t);const {started,artifact}=await publishReviewedOutput(ctx);
  await assert.rejects(()=>ctx.forge.completeSkillRun(ctx.projectId,started.run.id,{artifactIds:[artifact.id]},{principal:ctx.worker}),/trusted|verification receipt/i);
  const withReceipt=await ctx.forge.requestEvidence(ctx.projectId,{providerId:'skill-run-inspector',type:'skill-run-verification',title:'Skill run contract verification',subject:{skillRunId:started.run.id},metadata:{acceptedArtifactIds:[artifact.id]}},{principal:ctx.reviewer});
  const receipt=withReceipt.evidence.at(-1);
  const completed=await ctx.forge.completeSkillRun(ctx.projectId,started.run.id,{artifactIds:[artifact.id],verificationEvidenceId:receipt.id},{principal:ctx.worker});
  assert.equal(completed.run.status,'completed');
  assert.equal(completed.run.contractSha256,started.run.contractSha256);
  assert.equal(completed.run.handoff.validationState,'verified');
  assert.deepEqual(completed.run.handoff.artifactIds,[artifact.id]);
  assert.equal(completed.run.handoff.verificationEvidenceId,receipt.id);
});

test('skill run inspector rejects incomplete evidence packets and non-assurance output state',async(t)=>{
  const ctx=await setup(t);
  const started=await ctx.forge.startSkillRun(ctx.projectId,ctx.selected.name,{principal:ctx.worker,tools:['web-search'],targetOutputs:['problem-discovery']});
  const state=await ctx.forge.saveArtifact(ctx.projectId,{type:'problem-discovery',title:'Draft problem',content:{problem:'Incomplete'},producedBy:{skill:ctx.selected.name},consumes:[]},{principal:ctx.worker,skillRunId:started.run.id});
  const artifact=state.artifacts.at(-1);
  const result=await ctx.forge.requestEvidence(ctx.projectId,{providerId:'skill-run-inspector',type:'skill-run-verification',title:'Skill run contract verification',subject:{skillRunId:started.run.id},metadata:{acceptedArtifactIds:[artifact.id]}},{principal:ctx.reviewer});
  const receipt=result.evidence.at(-1);
  assert.equal(receipt.status,'fail');
  await assert.rejects(()=>ctx.forge.completeSkillRun(ctx.projectId,started.run.id,{artifactIds:[artifact.id],verificationEvidenceId:receipt.id},{principal:ctx.worker}),/pass|verification/i);
});

test('overlapping active skill runs for the same output target are rejected',async(t)=>{
  const ctx=await setup(t);
  await ctx.forge.startSkillRun(ctx.projectId,ctx.selected.name,{principal:ctx.worker,tools:['web-search'],targetOutputs:['problem-discovery']});
  const other=createPrincipal({id:'agent:worker-2',type:'agent',roles:['worker'],scopes:['skill:run'],trustDomain:'team:other'});
  await assert.rejects(()=>ctx.forge.startSkillRun(ctx.projectId,ctx.selected.name,{principal:other,tools:['web-search'],targetOutputs:['problem-discovery']}),/conflict|active skill run|output target/i);
});

test('workers cannot self-report utility metrics during skill completion',async(t)=>{
  const ctx=await setup(t);const {started,artifact}=await publishReviewedOutput(ctx);
  const withReceipt=await ctx.forge.requestEvidence(ctx.projectId,{providerId:'skill-run-inspector',type:'skill-run-verification',title:'Skill run contract verification',subject:{skillRunId:started.run.id},metadata:{acceptedArtifactIds:[artifact.id]}},{principal:ctx.reviewer});
  const receipt=withReceipt.evidence.at(-1);
  await assert.rejects(()=>ctx.forge.completeSkillRun(ctx.projectId,started.run.id,{artifactIds:[artifact.id],verificationEvidenceId:receipt.id,metrics:{passed:true,qualityDelta:100,tokenDelta:0,evaluationRunSha256:'a'.repeat(64)}},{principal:ctx.worker}),/trusted evaluation|self-report/i);
});
