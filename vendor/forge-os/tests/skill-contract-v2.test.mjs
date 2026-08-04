import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSkillContractV2 } from '../src/skills/v2/contracts.mjs';
import { loadPolicyProfiles, resolvePolicyProfileHashes } from '../src/skills/v2/policy-profiles.mjs';

const valid={
  schemaVersion:2,id:'reducing-react-render-thrashing',version:'1.0.0',skillType:'technique',maturity:'candidate',
  identity:{title:'Reducing React Render Thrashing',description:'Use when React components rerender excessively, input latency rises, or profiler traces show repeated updates.',domains:['frontend-engineering'],subdomains:['react','performance'],keywords:['rerender','profiler'],antiTriggers:['network-only latency','static HTML']},
  relations:{requires:['profiling-react-rendering'],specializes:[],composedWith:['measuring-interaction-latency'],conflictsWith:[],alternativesTo:[],supersedes:[]},
  contract:{consumes:[{type:'profiler-trace',schema:'artifact://frontend/profiler-trace/v1'}],produces:[{type:'render-optimization-plan',schema:'artifact://frontend/render-optimization-plan/v1'}],invariants:['behavior preserved'],requiredTools:['browser-profiler'],optionalTools:['repository']},
  procedure:{entryConditions:['stable reproduction'],steps:[{id:'baseline',action:'capture latency and render counts',evidence:'benchmark-receipt'}],fallbackPaths:[{condition:'profiler unavailable',action:'stop with blocker'}],stopConditions:['target reached']},
  verification:{executableChecks:['test command exits zero'],reviewerRole:'frontend-performance-reviewer',independentReview:true,evidenceTypes:['benchmark-receipt'],evaluatorIds:['frontend-render-evaluator']},
  context:{defaultSections:['overview','procedure','verification'],optionalSections:['failure-modes','examples'],maxDirectArtifacts:5,maxReferenceDepth:2,targetTokens:900,hardTokens:1400,outputReserveTokens:500},
  quality:{benchmarkIds:['frontend-render-001'],minimumSkillDepthScore:60,compatibleModels:['frontier'],knownLimitations:['framework scheduling changes']},
  policyProfiles:['forgeos-artifact-envelope-v2','independent-review-v1','fresh-evidence-v2','bounded-context-v2']
};

test('Skill Contract v2 accepts precise triggers, anti-triggers, evaluator bindings, and bounded context',()=>{
  assert.deepEqual(validateSkillContractV2(valid).id,valid.id);
});

test('Skill Contract v2 rejects vague discovery, missing anti-triggers, missing evaluators, and invalid budgets',()=>{
  assert.throws(()=>validateSkillContractV2({...valid,identity:{...valid.identity,description:'Use when needed'}}),/description|specific/i);
  assert.throws(()=>validateSkillContractV2({...valid,identity:{...valid.identity,antiTriggers:[]}}),/antiTriggers/i);
  assert.throws(()=>validateSkillContractV2({...valid,verification:{...valid.verification,evaluatorIds:[]}}),/evaluator/i);
  assert.throws(()=>validateSkillContractV2({...valid,context:{...valid.context,targetTokens:1500,hardTokens:1400}}),/token/i);
});

test('policy profiles are versioned, hashed, and resolved deterministically',async()=>{
  const profiles=await loadPolicyProfiles();
  assert.ok(profiles.length>=4);
  const resolved=resolvePolicyProfileHashes(valid.policyProfiles,profiles);
  assert.equal(resolved.length,4);
  assert.ok(resolved.every((item)=>/^[a-f0-9]{64}$/.test(item.sha256)));
  assert.deepEqual(resolvePolicyProfileHashes(valid.policyProfiles,profiles),resolved);
});
