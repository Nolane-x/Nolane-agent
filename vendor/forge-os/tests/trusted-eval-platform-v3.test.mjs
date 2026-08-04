import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EvalRunStore } from '../src/evals/eval-run-store.mjs';
import { TrustedEvalExecutor, runTrustedSkillEvaluation } from '../src/evals/trusted-runner.mjs';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const cases=[{id:'quality-case',domain:'saas',mode:'quality',prompt:'Produce a verified plan',forbiddenPatterns:['hand-wave'],requiredEvidence:['test receipt'],rubric:{novelty:{weight:.4,min:50},usefulness:{weight:.6,min:60}}}];
const trustedExecutor=new TrustedEvalExecutor({id:'local-judge',version:'3.0.0',execute:async({caseDefinition,seed,mode})=>({text:`${mode}-${seed}`,evidence:caseDefinition.requiredEvidence,metrics:{novelty:mode==='candidate'?82:70,usefulness:mode==='candidate'?86:72},tokens:mode==='candidate'?900:1000,criticalFailures:0})});

test('trusted eval run is immutable, content-addressed, and detects tampering',async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-eval-store-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const store=new EvalRunStore(root);
  const result=await runTrustedSkillEvaluation({skillName:'example-skill',skillVersion:'3.0.0',cases,seeds:[1,2,3,4],executor:trustedExecutor,store});
  assert.equal(result.run.decision.decision,'promote');
  assert.match(result.run.id,/^eval_[a-f0-9]{64}$/);
  assert.equal((await store.read(result.run.id)).sha256,result.run.sha256);
  const file=path.join(root,`${result.run.id}.json`);const raw=JSON.parse(await readFile(file,'utf8'));raw.comparison.candidate.quality=0;await writeFile(file,JSON.stringify(raw));
  await assert.rejects(()=>store.read(result.run.id),/hash|integrity/i);
});

test('trusted runner derives paired confidence from the same case and seed matrix',async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-eval-paired-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const result=await runTrustedSkillEvaluation({skillName:'example-skill',skillVersion:'3.0.0',cases,seeds:[1,2,3,4],executor:trustedExecutor,store:new EvalRunStore(root)});
  assert.equal(result.run.matrix.cases,1);assert.equal(result.run.matrix.seeds,4);
  assert.equal(result.run.paired.samples,4);
  assert.ok(result.run.paired.qualityDelta.confidence95.low>0);
  assert.equal(result.run.executor.id,'local-judge');
  assert.equal(result.run.corpusSha256.length,64);
});

test('ForgeOS applies utility only from a persisted trusted eval run',async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-eval-apply-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const evalStore=new EvalRunStore(path.join(root,'eval-runs'));
  const result=await runTrustedSkillEvaluation({skillName:'extracting-user-pain',skillVersion:'0.2.0',cases,seeds:[1,2,3,4],executor:trustedExecutor,store:evalStore});
  const forge=new ForgeOrchestrator(new ProjectStore(path.join(root,'projects')),{evalRunStore:evalStore});
  const project=await forge.createProject({name:'Eval utility',assurance:'A1'});
  const admin=createPrincipal({id:'service:eval-admin',type:'service',roles:['eval-admin'],scopes:['eval:apply'],trustDomain:'forgeos:eval'});
  const updated=await forge.applySkillEvaluation(project.id,'extracting-user-pain',result.run.id,{principal:admin});
  assert.equal(updated.skillUtility['extracting-user-pain'].runs,1);
  assert.equal(updated.skillUtility['extracting-user-pain'].lastEvaluationRunSha256,result.run.sha256);
  await assert.rejects(()=>forge.applySkillEvaluation(project.id,'another-skill',result.run.id,{principal:admin}),/skill/i);
});

test('a caller cannot construct a synthetic eval run through the orchestrator',async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-eval-reject-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const forge=new ForgeOrchestrator(new ProjectStore(root));const project=await forge.createProject({name:'No synthetic eval'});
  const worker=createPrincipal({id:'agent:worker',type:'agent',roles:['worker'],scopes:['skill:run'],trustDomain:'team:delivery'});
  await assert.rejects(()=>forge.applySkillEvaluation(project.id,'using-forge-os',{passRate:1,quality:100},{principal:worker}),/trusted eval|configured|scope|role/i);
});
