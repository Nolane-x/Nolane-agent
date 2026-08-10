import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { callForgeTool } from '../src/server/tool-registry.mjs';
import { createTestEvidenceRegistry } from './helpers/trusted-evidence.mjs';

const human=createPrincipal({id:'human:release-owner',type:'human',roles:['owner','security-reviewer'],scopes:['*'],trustDomain:'team:security'});
const worker=createPrincipal({id:'agent:builder',type:'agent',roles:['worker'],scopes:['*'],trustDomain:'team:build'});
const reviewer=createPrincipal({id:'agent:reviewer',type:'agent',roles:['reviewer'],scopes:['*'],trustDomain:'team:review'});

const ideas=Array.from({length:5},(_,index)=>({
  id:`idea-${index+1}`,title:`Concept ${index+1}`,thesis:`A distinct product thesis ${index+1}`,targetUser:'Engineering teams',hiddenProblem:`Hidden coordination problem ${index+1}`,
  mechanism:['event-sourced proof graph','local-first capability exchange','market-based agent scheduler','digital-twin failure rehearsal','privacy-preserving federated workflow'][index],
  interface:['graph console','ambient command palette','auction board','simulation cockpit','encrypted workspace'][index],
  valueModel:`Value model ${index+1}`,distribution:`Distribution path ${index+1}`,assumptions:[`Assumption ${index+1}`],closestPattern:`Pattern ${index+1}`,differences:[`Mechanism differs ${index+1}`],cheapestExperiment:`Run experiment ${index+1}`,failureModes:[`Failure ${index+1}`],
}));
const score=(ideaId,index)=>({ideaId,novelty:90-index,usefulness:85,feasibility:80,leverage:82,defensibility:75,testability:88,clarity:86,evidence:72});

async function addEvidence(forge,projectId,type,{principal=reviewer,subject={},label=type}={}){
  return callForgeTool('forge_evidence_request',{projectId,providerId:'test-command',recipeId:'pass',type,title:`${label} proof`,subject,metadata:{label}},forge,{principal});
}
async function artifact(forge,projectId,type,content,{principal=worker,consumes=[],autoReview=true}={}){
  let result=await callForgeTool('forge_artifact_create',{projectId,type,title:type,content,consumes},forge,{principal});
  let created=result.project.artifacts.find((item)=>item.type===type&&['draft','review','verified'].includes(item.state));
  if(autoReview){
    result=await callForgeTool('forge_artifact_review',{projectId,artifactId:created.id,notes:`Independent review for ${type}.`},forge,{principal:reviewer});
    created=result.project.artifacts.find((item)=>item.id===created.id);
  }
  return created;
}
async function passAndAdvance(forge,projectId){
  const checked=await callForgeTool('forge_gate_run',{projectId},forge,{principal:reviewer});
  assert.equal(checked.gate.status,'pass',`${checked.gate.stage}: ${checked.gate.failedRules?.join(', ')}`);
  return (await callForgeTool('forge_stage_advance',{projectId},forge,{principal:reviewer})).project;
}

test('public ForgeOS tool surface can complete a fully evidence-gated A1 lifecycle to an immutable release',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forgeos-public-e2e-'));
  try{
    const forge=new ForgeOrchestrator(new ProjectStore(root),{evidenceProviders:createTestEvidenceRegistry(root)});
    let result=await callForgeTool('forge_project_create',{name:'Public lifecycle proof',domain:'saas',assurance:'A1'},forge,{principal:human});
    const projectId=result.project.id;
    await callForgeTool('forge_project_access_grant',{projectId,principalId:worker.id,trustDomain:worker.trustDomain,capabilities:['read','write']},forge,{principal:human});
    await callForgeTool('forge_project_access_grant',{projectId,principalId:reviewer.id,trustDomain:reviewer.trustDomain,capabilities:['read','write','review','release']},forge,{principal:human});

    await callForgeTool('forge_intent_record',{projectId,intent:{goal:'Build a verifiable agent product',audience:'Product engineering teams',constraints:['Public tools only'],success:['Reach released stage with fresh evidence'],nonGoals:['Bypass gates'],preferredDomain:'saas',confirmed:true}},forge,{principal:human});
    await passAndAdvance(forge,projectId);

    await artifact(forge,projectId,'problem-discovery',{problem:'Teams cannot prove that agent-generated products satisfy current requirements.'});
    await passAndAdvance(forge,projectId);

    await artifact(forge,projectId,'research-synthesis',{findings:['Typed proof and revision binding prevent stale approvals.']});
    await addEvidence(forge,projectId,'research-source',{label:'authoritative research source'});
    await passAndAdvance(forge,projectId);

    await callForgeTool('forge_ideas_save',{projectId,ideas},forge,{principal:worker});
    await passAndAdvance(forge,projectId);

    await callForgeTool('forge_ideas_score',{projectId,scores:ideas.map((idea,index)=>score(idea.id,index)),rubricVersion:'creativity-v2'},forge,{principal:reviewer});
    await passAndAdvance(forge,projectId);

    const approval=await callForgeTool('forge_approval_request',{projectId,action:'select-idea:idea-1',ttlMs:60_000},forge,{principal:human});
    await callForgeTool('forge_idea_select',{projectId,ideaId:'idea-1',reason:'Best evidence-to-complexity ratio.',approvalToken:approval.approval.token},forge,{principal:human});
    await passAndAdvance(forge,projectId);

    const thesis=await artifact(forge,projectId,'product-thesis',{thesis:'A revision-bound control plane for product engineering agents.'});
    await artifact(forge,projectId,'capability-map',{capabilities:['typed artifacts','fresh gates','interoperable protocols']},{consumes:[thesis.id]});
    await passAndAdvance(forge,projectId);

    await artifact(forge,projectId,'ux-contract',{journeys:['Create project','Resolve gate','Inspect proof','Release']});
    await addEvidence(forge,projectId,'ux-evidence',{label:'critical flow usability evidence'});
    await passAndAdvance(forge,projectId);

    const architecture=await artifact(forge,projectId,'architecture-decision',{decision:'Use a typed artifact graph and revision-bound evidence ledger.'});
    await artifact(forge,projectId,'threat-model',{threats:['stale proof','forged approval','cross-principal task access']},{consumes:[architecture.id]});
    await passAndAdvance(forge,projectId);

    const plan=await artifact(forge,projectId,'execution-plan',{tasks:['Implement invariant','write failing test','verify fix']});
    await artifact(forge,projectId,'acceptance-contracts',{criteria:['Every stage requires a fresh passing gate.']},{consumes:[plan.id]});
    await passAndAdvance(forge,projectId);

    await addEvidence(forge,projectId,'build-output',{label:'reproducible build'});
    await addEvidence(forge,projectId,'feature-test',{label:'critical feature tests'});
    await passAndAdvance(forge,projectId);

    await addEvidence(forge,projectId,'verification-report',{label:'full verification report'});
    await addEvidence(forge,projectId,'security-review',{label:'independent security review'});
    await addEvidence(forge,projectId,'ux-evidence',{label:'release UX review'});
    await addEvidence(forge,projectId,'integration-test',{label:'integration suite'});
    await addEvidence(forge,projectId,'rollback-proof',{label:'rollback rehearsal'});
    await passAndAdvance(forge,projectId);

    let dossier=await artifact(forge,projectId,'release-dossier',{evidence:['verification report','security review','rollback statement']},{autoReview:false});
    await callForgeTool('forge_artifact_review',{projectId,artifactId:dossier.id,notes:'Independent release dossier review completed.'},forge,{principal:reviewer});
    dossier=(await callForgeTool('forge_project_get',{projectId},forge,{principal:human})).project.artifacts.find((item)=>item.id===dossier.id);
    const artifactProof=await addEvidence(forge,projectId,'artifact-verification',{label:'release dossier integrity',subject:{artifactId:dossier.id,artifactSha256:dossier.sha256}});
    const artifactEvidenceId=artifactProof.project.evidence.at(-1).id;
    await callForgeTool('forge_artifact_verify',{projectId,artifactId:dossier.id,evidence:[artifactEvidenceId]},forge,{principal:reviewer});
    await addEvidence(forge,projectId,'verification-report',{label:'release readiness verification'});
    await addEvidence(forge,projectId,'integration-test',{label:'release integration suite'});
    await addEvidence(forge,projectId,'rollback-proof',{label:'release rollback rehearsal'});
    const released=await passAndAdvance(forge,projectId);

    assert.equal(released.stage,'released');
    assert.ok(released.sealedAt);
    assert.ok(Number.isInteger(released.releaseRevision));
    await assert.rejects(()=>callForgeTool('forge_evidence_add',{projectId,type:'post-release-mutation',title:'not allowed',summary:'must fail'},forge,{principal:reviewer}),/sealed/);
  }finally{await rm(root,{recursive:true,force:true});}
});
