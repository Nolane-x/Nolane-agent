import test from 'node:test';
import assert from 'node:assert/strict';
import { TrustedSemanticJudge, runSkillEvaluationV2 } from '../src/evals/skill-lab-v2.mjs';
import { createHoldoutManifest } from '../src/evals/holdout-manifest.mjs';
import { classifyMaturity } from '../src/evals/maturity.mjs';
import { auditSkillDepth, auditBoilerplate } from '../src/evals/skill-depth-audit.mjs';

test('producer cannot self-report quality or pass metrics and deterministic failure always blocks promotion',async()=>{
 const cases=[{id:'c1',input:'x',rubric:{correctness:{weight:1}},expected:'ok'}];
 const producer=async({mode})=>({text:mode==='candidate'?'ok':'bad',metrics:{correctness:100,passRate:1},tokens:10});
 const judge=new TrustedSemanticJudge({id:'judge-1',trustDomain:'independent',score:async({output})=>({items:{correctness:output.text==='ok'?90:10},uncertainty:.05,evidenceSpans:['text']})});
 const result=await runSkillEvaluationV2({skill:{id:'s',version:'1.0.0',authorTrustDomain:'author'},cases,seeds:[1,2,3,4],producer,deterministicChecks:[({output})=>({id:'must-contain-proof',passed:output.text.includes('proof'),metrics:{},evidence:[]})],judges:[judge],policy:{minimumSamples:4}});
 assert.equal(result.decision.status,'quarantined');
 assert.ok(result.decision.blockers.some(x=>/deterministic/i.test(x)));
 assert.ok(!JSON.stringify(result).includes('passRate":1'));
 assert.notEqual(result.candidate.quality,100);
});

test('independent judge ensemble scores semantics while executable checks remain authoritative',async()=>{
 const cases=Array.from({length:5},(_,i)=>({id:`c${i}`,input:'task',rubric:{correctness:{weight:.7},clarity:{weight:.3}}}));
 const producer=async({mode})=>({text:mode==='candidate'?'proof correct clear':'incorrect',tokens:mode==='candidate'?20:18});
 const judges=[
  new TrustedSemanticJudge({id:'j1',trustDomain:'review-a',score:async({output})=>({items:{correctness:output.text.includes('correct')?90:10,clarity:output.text.includes('clear')?85:30},uncertainty:.05,evidenceSpans:['text']})}),
  new TrustedSemanticJudge({id:'j2',trustDomain:'review-b',score:async({output})=>({items:{correctness:output.text.includes('correct')?88:12,clarity:output.text.includes('clear')?82:35},uncertainty:.08,evidenceSpans:['text']})})
 ];
 const result=await runSkillEvaluationV2({skill:{id:'s',version:'1.0.0',authorTrustDomain:'author'},cases,seeds:[1,2,3],producer,deterministicChecks:[({output})=>({id:'proof',passed:output.text.includes('proof'),metrics:{proof:1},evidence:['text']})],judges,policy:{minimumSamples:10,minimumQualityDelta:10,maximumTokenGrowth:.5}});
 assert.equal(result.decision.status,'validated');
 assert.ok(result.candidate.quality>result.baseline.quality);
 assert.ok(result.paired.qualityDelta.confidence95.low>0);
 assert.equal(result.judgeAgreement.judges,2);
 assert.match(result.evalRunSha256,/^[a-f0-9]{64}$/);
});

test('holdout manifest reveals hashes and counts but not prompts',()=>{
 const manifest=createHoldoutManifest([{id:'h1',prompt:'secret prompt',rubric:{x:1}},{id:'h2',prompt:'another secret',rubric:{x:1}}],{version:'2026.07'});
 assert.equal(manifest.caseCount,2);
 assert.ok(!JSON.stringify(manifest).includes('secret prompt'));
 assert.equal(manifest.caseIds.length,2);
 assert.match(manifest.corpusSha256,/^[a-f0-9]{64}$/);
});

test('maturity model requires depth, confidence, multi-model evidence, and no critical regression',()=>{
 assert.equal(classifyMaturity({depthScore:91,publicScenarios:60,holdoutScenarios:20,modelFamilies:4,confidenceLowerBound:.08,criticalFailures:0,humanReviewed:true,productionEvidence:true}),'certified');
 assert.equal(classifyMaturity({depthScore:85,publicScenarios:20,holdoutScenarios:5,modelFamilies:2,confidenceLowerBound:.02,criticalFailures:0,humanReviewed:false,productionEvidence:false}),'stable');
 assert.equal(classifyMaturity({depthScore:99,publicScenarios:100,holdoutScenarios:50,modelFamilies:5,confidenceLowerBound:.2,criticalFailures:1,humanReviewed:true,productionEvidence:true}),'quarantined');
});

test('skill depth audit rewards specific triggers, decisions, failure modes, and executable verification',()=>{
 const deep={identity:{description:'Use when React components rerender excessively or profiler traces show wasted updates.',antiTriggers:['network-only latency']},procedure:{steps:[{id:'baseline',action:'measure p95'},{id:'classify',action:'map render causes'},{id:'fix',action:'apply smallest change'}],fallbackPaths:[{condition:'profiler unavailable',action:'stop'}],stopConditions:['p95 target reached']},verification:{executableChecks:['test exits zero','p95 does not regress'],evidenceTypes:['benchmark-receipt']},relations:{requires:['profiling-react-rendering']},context:{targetTokens:900,hardTokens:1400}};
 assert.ok(auditSkillDepth(deep).score>=80);
 const shallow={identity:{description:'Use when this skill is required.',antiTriggers:[]},procedure:{steps:[{id:'do',action:'do the work'}],fallbackPaths:[],stopConditions:[]},verification:{executableChecks:[],evidenceTypes:[]},relations:{requires:[]},context:{targetTokens:2000,hardTokens:4000}};
 assert.ok(auditSkillDepth(shallow).score<60);
 const boiler=auditBoilerplate([{id:'a',lines:['same','same2','unique a']},{id:'b',lines:['same','same2','unique b']},{id:'c',lines:['same','same2','unique c']}],{commonThreshold:.66});
 assert.ok(boiler.skills.every(x=>x.boilerplateRatio>0.5));
});
