import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createTestEvidenceRegistry } from './helpers/trusted-evidence.mjs';

const intent={goal:'Build a verified SaaS agent platform',audience:'software teams',constraints:['provider neutral'],success:['critical flow passes'],nonGoals:['replace human decisions'],preferredDomain:'saas',confirmed:true};
const worker=createPrincipal({id:'agent:worker',type:'agent',roles:['worker'],scopes:['*'],trustDomain:'team:build'});
const reviewer=createPrincipal({id:'human:reviewer',type:'human',roles:['reviewer','security-reviewer'],scopes:['*'],trustDomain:'team:security'});
const owner=createPrincipal({id:'human:owner',type:'human',roles:['owner'],scopes:['*','approve']});

async function fixture(t,name='Forge'){const dir=await mkdtemp(path.join(tmpdir(),'forge-orch-'));t.after(()=>rm(dir,{recursive:true,force:true}));const forge=new ForgeOrchestrator(new ProjectStore(dir),{evidenceProviders:createTestEvidenceRegistry(dir)});const project=await forge.createProject({name,domain:'saas',assurance:'A1'});return {forge,project};}

test('orchestrator records authenticated intent, artifacts, routes, findings, and subject-bound evidence',async t=>{const {forge,project}=await fixture(t);await forge.recordIntent(project.id,intent);assert.equal((await forge.runCurrentGate(project.id)).status,'pass');await forge.advance(project.id);assert.ok((await forge.routeNextSkills(project.id,{tools:['web-search']})).length>=1);const saved=await forge.saveArtifact(project.id,{type:'problem-discovery',content:{problem:'agent delivery lacks evidence'},producedBy:{skill:'extracting-user-pain'},consumes:[]},{principal:worker});assert.equal(saved.artifacts.at(-1).producedBy.principalId,worker.id);const found=await forge.addFinding(project.id,{title:'Missing tenant boundary test',severity:'high',category:'security'},{principal:worker});const findingId=found.findings.at(-1).id;const withEvidence=await forge.requestEvidence(project.id,{id:'evidence_tenant_fix',providerId:'test-command',recipeId:'pass',type:'finding-resolution',title:'Tenant isolation regression',subject:{findingId}},{principal:reviewer});assert.equal(withEvidence.evidence.at(-1).subject.findingId,findingId);await forge.closeFinding(project.id,findingId,{resolution:'Added tenant-isolation regression test',evidence:['evidence_tenant_fix']},{principal:reviewer});assert.equal((await forge.getProject(project.id)).findings.at(-1).status,'closed');});

test('orchestrator refuses stage advancement without a fresh passing current gate',async t=>{const {forge,project}=await fixture(t,'Blocked');await assert.rejects(()=>forge.advance(project.id),/gate/i);});

test('critical finding acceptance requires a one-time human approval bound to current revision',async t=>{const {forge,project}=await fixture(t,'Risk');const updated=await forge.addFinding(project.id,{title:'Potential data loss',severity:'critical',category:'reliability'},{principal:worker});const findingId=updated.findings.at(-1).id;await assert.rejects(()=>forge.acceptFinding(project.id,findingId,{reason:'beta',approvalToken:'fake'},{principal:owner}),/approval token/i);const approval=await forge.requestApproval(project.id,`accept-finding:${findingId}`,{principal:owner});await forge.acceptFinding(project.id,findingId,{reason:'Temporary controlled beta risk',approvalToken:approval.token},{principal:owner});assert.equal((await forge.getProject(project.id)).findings.at(-1).acceptedBy.id,owner.id);await assert.rejects(()=>forge.acceptFinding(project.id,findingId,{reason:'reuse',approvalToken:approval.token},{principal:owner}),/already been used|invalid/i);});
