import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createTestEvidenceRegistry } from './helpers/trusted-evidence.mjs';

const worker=createPrincipal({id:'agent:artifact-worker',type:'agent',roles:['worker'],trustDomain:'team:build'});
const reviewer=createPrincipal({id:'human:artifact-reviewer',type:'human',roles:['reviewer'],trustDomain:'team:review'});
const sameDomainReviewer=createPrincipal({id:'human:other-account',type:'human',roles:['reviewer'],trustDomain:'team:build'});
const noRole=createPrincipal({id:'human:no-role',type:'human',roles:['observer'],trustDomain:'team:security'});
const input=(overrides={})=>({type:'problem-discovery',slot:'primary',schemaVersion:'1.0.0',title:'Problem',content:{problem:'Agents need trustworthy artifact lineage.'},producedBy:{skill:'extracting-user-pain'},consumes:[],decisions:[],evidence:[],residualRisks:[],...overrides});

async function fixture(t,assurance='A1'){
  const root=await mkdtemp(path.join(tmpdir(),'forge-artifact-trust-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const store=new ProjectStore(root);
  const forge=new ForgeOrchestrator(store,{evidenceProviders:createTestEvidenceRegistry(root)});
  const project=await forge.createProject({name:'Artifact trust',assurance});
  return {root,store,forge,project};
}

test('artifact envelope detects lifecycle and provenance tampering at rest',async(t)=>{
  const {root,store,forge,project}=await fixture(t);
  const state=await forge.saveArtifact(project.id,input(),{principal:worker});
  const file=path.join(root,`${project.id}.json`);
  const raw=JSON.parse(await readFile(file,'utf8'));
  raw.artifacts[0].state='verified';
  raw.artifacts[0].producedBy.trustDomain='attacker';
  raw.artifacts[0].verification={reviewer:{id:'fake',type:'human',roles:['reviewer'],trustDomain:'fake'},verifiedAt:new Date().toISOString(),gateId:null};
  await writeFile(file,JSON.stringify(raw));
  await assert.rejects(()=>store.read(project.id),/envelope hash mismatch/i);
  assert.equal(state.artifacts[0].state,'draft');
});

test('artifact slots allow composition while preventing duplicate active versions in one slot',async(t)=>{
  const {forge,project}=await fixture(t);
  await forge.saveArtifact(project.id,input({slot:'user-research'}),{principal:worker});
  const state=await forge.saveArtifact(project.id,input({slot:'market-research',content:{problem:'Market assumptions are unverified.'}}),{principal:worker});
  assert.deepEqual(state.artifacts.map((item)=>item.slot).sort(),['market-research','user-research']);
  await assert.rejects(()=>forge.saveArtifact(project.id,input({slot:'market-research',content:{problem:'Duplicate active slot.'}}),{principal:worker}),/active artifact.*problem-discovery.*market-research/i);
});

test('A1 artifact verification requires review by an authorized independent trust domain',async(t)=>{
  const {forge,project}=await fixture(t,'A1');
  let state=await forge.saveArtifact(project.id,input(),{principal:worker});
  const artifact=state.artifacts[0];
  state=await forge.requestEvidence(project.id,{providerId:'test-command',recipeId:'pass',type:'artifact-verification',title:'Artifact verification',subject:{artifactId:artifact.id,artifactSha256:artifact.sha256}},{principal:reviewer});
  const evidenceId=state.evidence.at(-1).id;
  await assert.rejects(()=>forge.verifyArtifact(project.id,artifact.id,{evidence:[evidenceId]},{principal:reviewer}),/must enter review/i);
  await assert.rejects(()=>forge.reviewArtifact(project.id,artifact.id,{notes:'Looks good.'},{principal:sameDomainReviewer}),/independent trust domain/i);
  await assert.rejects(()=>forge.reviewArtifact(project.id,artifact.id,{notes:'Looks good.'},{principal:noRole}),/reviewer role/i);
  await forge.reviewArtifact(project.id,artifact.id,{notes:'Contract and content reviewed.'},{principal:reviewer});
  state=await forge.verifyArtifact(project.id,artifact.id,{evidence:[evidenceId]},{principal:reviewer});
  assert.equal(state.artifacts[0].state,'verified');
});

test('dependency hashes are derived by the server and bound to active inputs',async(t)=>{
  const {forge,project}=await fixture(t);
  let state=await forge.saveArtifact(project.id,input({id:'artifact_problem'}),{principal:worker});
  const parent=state.artifacts[0];
  state=await forge.saveArtifact(project.id,{type:'research-synthesis',slot:'primary',title:'Research',content:{findings:['Proof must be truth-bound.']},producedBy:{skill:'synthesizing-product-evidence'},consumes:[parent.id],dependencyHashes:{[parent.id]:'0'.repeat(64)},decisions:[],evidence:[],residualRisks:[]},{principal:worker});
  const child=state.artifacts.find((item)=>item.type==='research-synthesis');
  assert.equal(child.dependencyHashes[parent.id],parent.contentHash);
  assert.notEqual(child.dependencyHashes[parent.id],'0'.repeat(64));
});

test('supersession records two-way lineage and invalidates downstream consumers',async(t)=>{
  const {forge,project}=await fixture(t);
  let state=await forge.saveArtifact(project.id,input({id:'artifact_problem'}),{principal:worker});
  const parent=state.artifacts[0];
  await forge.saveArtifact(project.id,{id:'artifact_research',type:'research-synthesis',slot:'primary',title:'Research',content:{findings:['Initial result']},producedBy:{skill:'synthesizing-product-evidence'},consumes:[parent.id],decisions:[],evidence:[],residualRisks:[]},{principal:worker});
  state=await forge.supersedeArtifact(project.id,parent.id,input({id:'artifact_problem_v2',content:{problem:'Updated invariant.'}}),{principal:worker});
  const old=state.artifacts.find((item)=>item.id===parent.id);
  const replacement=state.artifacts.find((item)=>item.id==='artifact_problem_v2');
  const child=state.artifacts.find((item)=>item.id==='artifact_research');
  assert.equal(old.supersededBy,replacement.id);
  assert.equal(replacement.supersedes,old.id);
  assert.equal(replacement.slot,old.slot);
  assert.equal(child.state,'invalidated');
});
