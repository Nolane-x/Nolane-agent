import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCapabilityGraphV2 } from '../src/capabilities/v2/compiler.mjs';
import { loadBuiltInProviders } from '../src/federation/local-provider-seed.mjs';
import { routeSkillIntelligence } from '../src/intelligence/router.mjs';

async function state(){return{graph:await loadCapabilityGraphV2(),providers:await loadBuiltInProviders()};}

test('unified router retrieves the correct API technique and explains exclusions',async()=>{
 const {graph,providers}=await state();
 const plan=routeSkillIntelligence({graph,providers,intent:{query:'Design a versioned API contract for a public SDK',domains:['api-integration'],taskClass:'architecture'},context:{model:'gpt-5.6',tools:['api-client'],assurance:'A2',allowExternal:false,operation:'planning'}});
 assert.equal(plan.steps[0].techniqueId,'technique.designing-api-contracts');
 assert.ok(plan.steps[0].providerId==='local-skill.designing-api-contracts');
 assert.ok(plan.inclusions.some((item)=>item.id==='technique.designing-api-contracts'));
 assert.ok(plan.exclusions.length>0);
 assert.match(plan.routePlanSha256,/^[a-f0-9]{64}$/);
});

test('anti-triggers prevent superficially similar routing',async()=>{
 const {graph,providers}=await state();
 const plan=routeSkillIntelligence({graph,providers,intent:{query:'Add observability instrumentation without an API change',domains:['software-architecture'],taskClass:'observability'},context:{model:'gpt-5.6',tools:['repository'],assurance:'A1',allowExternal:false}});
 assert.ok(!plan.steps.some((step)=>step.techniqueId==='technique.designing-api-contracts'));
 assert.ok(plan.exclusions.some((item)=>item.id==='technique.designing-api-contracts'&&item.reasons.some((reason)=>/anti-trigger/i.test(reason))));
});

test('required tools are hard blockers and unsafe providers never activate',async()=>{
 const {graph,providers}=await state();
 const modified=providers.map((provider)=>provider.providerId==='local-skill.designing-api-contracts'?{...provider,status:'quarantined'}:provider);
 const plan=routeSkillIntelligence({graph,providers:modified,intent:{query:'Design API contracts',domains:['api-integration'],taskClass:'architecture'},context:{model:'gpt-5.6',tools:[],assurance:'A2',allowExternal:false}});
 assert.ok(!plan.steps.some((step)=>step.providerId==='local-skill.designing-api-contracts'));
 assert.ok(plan.exclusions.some((item)=>item.id==='technique.designing-api-contracts'&&item.reasons.some((reason)=>/provider/i.test(reason))));
});

test('segmented measured utility affects provider and technique selection without overriding hard policy',()=>{
 const graph={schemaVersion:2,graphSha256:'a'.repeat(64),outcomes:[{outcomeId:'outcome.x',kind:'outcome',domain:'x',title:'Choose approach',consumes:[],produces:['decision'],evidence:['review'],requiredTools:[],riskClass:'low',legacyScaffold:false,contractSha256:'1'.repeat(64)}],techniques:[
  {techniqueId:'technique.a',kind:'technique',skillId:'a',skillContractVersion:2,maturity:'stable',triggers:['choose approach'],antiTriggers:['only one legal option'],domains:['x'],consumes:[],produces:['decision'],requiredTools:[],optionalTools:[],sectionIndexSha256:'2'.repeat(64),defaultSections:['overview'],hardTokens:500,policyProfileHashes:[],contractSha256:'3'.repeat(64)},
  {techniqueId:'technique.b',kind:'technique',skillId:'b',skillContractVersion:2,maturity:'stable',triggers:['choose approach'],antiTriggers:['only one legal option'],domains:['x'],consumes:[],produces:['decision'],requiredTools:[],optionalTools:[],sectionIndexSha256:'4'.repeat(64),defaultSections:['overview'],hardTokens:500,policyProfileHashes:[],contractSha256:'5'.repeat(64)}],providers:[{providerId:'p.a'},{providerId:'p.b'}],evaluators:[{evaluatorId:'e.a'},{evaluatorId:'e.b'}],relations:[{type:'satisfies',from:'technique.a',to:'outcome.x',fitScore:90,mappingEvidence:'m'},{type:'satisfies',from:'technique.b',to:'outcome.x',fitScore:90,mappingEvidence:'m'},{type:'deliveredBy',from:'technique.a',to:'p.a'},{type:'deliveredBy',from:'technique.b',to:'p.b'},{type:'validatedBy',from:'technique.a',to:'e.a'},{type:'validatedBy',from:'technique.b',to:'e.b'}]};
 const providers=[{providerId:'p.a',capabilityId:'x',capabilityIds:['x'],kind:'skill',status:'stable',sourceId:'local',sourceCoordinate:'x',providerDigest:'a'.repeat(64),contentDigest:'b'.repeat(64),trust:{score:90,blockers:[]},license:{mode:'vendor-allowed'},compatibility:{agents:['*'],tools:[]},estimatedTokens:100,material:{type:'local-agent-skill-v2',defaultSections:['overview'],sectionIndex:{sections:[{id:'overview',tokens:{'gpt-5.6':100}}]}}},{providerId:'p.b',capabilityId:'x',capabilityIds:['x'],kind:'skill',status:'stable',sourceId:'local',sourceCoordinate:'y',providerDigest:'c'.repeat(64),contentDigest:'d'.repeat(64),trust:{score:90,blockers:[]},license:{mode:'vendor-allowed'},compatibility:{agents:['*'],tools:[]},estimatedTokens:100,material:{type:'local-agent-skill-v2',defaultSections:['overview'],sectionIndex:{sections:[{id:'overview',tokens:{'gpt-5.6':100}}]}}}];
 const plan=routeSkillIntelligence({graph,providers,intent:{query:'choose approach',domains:['x'],taskClass:'decision'},context:{model:'gpt-5.6',tools:[],assurance:'A1',utility:{'technique.a':{passRateByModel:{'gpt-5.6':.55},qualityDeltaByTaskClass:{decision:0}},'technique.b':{passRateByModel:{'gpt-5.6':.9},qualityDeltaByTaskClass:{decision:.2}}}}});
 assert.equal(plan.steps[0].techniqueId,'technique.b');
});

test('same semantic input produces a deterministic RoutePlan and multi-outcome request composes a DAG',async()=>{
 const {graph,providers}=await state();const input={graph,providers,intent:{query:'Frame the user intent and write an executable delivery plan',domains:['product-management','operations-leadership'],taskClass:'planning',targetOutcomeIds:['outcome.product-management.frame-problem','outcome.operations-leadership.plan-delivery']},context:{model:'gpt-5.6',tools:['research','planning'],assurance:'A1',allowExternal:false,operation:'planning'}};
 const a=routeSkillIntelligence(input);const b=routeSkillIntelligence(input);
 assert.equal(a.routePlanSha256,b.routePlanSha256);
 assert.ok(a.steps.length>=2);
 assert.ok(a.executionGroups.some((group)=>group.mode==='parallel'||group.mode==='sequential'));
});

test('query-only retrieval can select a precise L0 technique without an explicit legacy outcome target',async()=>{
 const {graph,providers}=await state();
 const intent=routeSkillIntelligence({graph,providers,intent:{query:'Clarify ambiguous user goals, hidden constraints, and non-goals before building',domains:['product-management'],taskClass:'discovery'},context:{model:'gpt-5.6',tools:[],assurance:'A1',allowExternal:false,operation:'planning'}});
 assert.equal(intent.steps[0]?.techniqueId,'technique.resolving-user-intent');
 assert.equal(intent.blockers.length,0);
 const context=routeSkillIntelligence({graph,providers,intent:{query:'Compile minimal global agent context and enforce token budgets across skills, code, artifacts, memory, and logs',domains:['ai-agent-engineering'],taskClass:'context'},context:{model:'gpt-5.6',tools:[],assurance:'A1',allowExternal:false,operation:'planning'}});
 assert.ok(['technique.compiling-global-context','technique.enforcing-context-budgets','technique.compiling-context-pack'].includes(context.steps[0]?.techniqueId));
 assert.equal(context.blockers.length,0);
});
