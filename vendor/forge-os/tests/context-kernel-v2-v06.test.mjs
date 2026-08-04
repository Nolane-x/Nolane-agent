import test from 'node:test';import assert from 'node:assert/strict';
import {compileWorkUnitContexts} from '../src/context/work-unit-context.mjs';
import {LazyToolRegistry} from '../src/context/lazy-tool-registry.mjs';
import {compilePromptCachePlan} from '../src/context/prompt-cache-plan-v2.mjs';
import {selectInstinctContext} from '../src/context/instinct-injector.mjs';

test('work-unit context compiler isolates sibling files, rules, memories, and skills under one global budget',async()=>{
 const result=await compileWorkUnitContexts({
  model:'gpt-5.6',hardInputLimit:4000,outputReserve:800,safetyReserve:400,
  shared:{system:'ForgeOS policy',task:'Review the branch',artifacts:[{id:'a1',text:'auth contract',unitIds:['u1']},{id:'a2',text:'db contract',unitIds:['u2']}]},
  workUnits:[{unitId:'u1',files:[{path:'auth.mjs',text:'auth code'}],skillSections:[{id:'auth-procedure',text:'auth procedure'}],rules:[{id:'auth-rule',text:'auth rule'}],memory:[{id:'m1',text:'auth memory'}]},{unitId:'u2',files:[{path:'db.sql',text:'db code'}],skillSections:[{id:'db-procedure',text:'db procedure'}],rules:[{id:'db-rule',text:'db rule'}],memory:[]}]
 });
 assert.equal(result.contexts.length,2);const u1=result.contexts.find(x=>x.unitId==='u1');assert.match(JSON.stringify(u1.messages),/auth code/);assert.doesNotMatch(JSON.stringify(u1.messages),/db code|db rule|db contract/);assert.ok(result.totalEstimatedTokens<=result.availableInputTokens);assert.equal(result.omissions.some(x=>!x.reason),false);assert.match(result.contextReceiptSha256,/^[a-f0-9]{64}$/);
});

test('lazy tool registry advertises only tools selected by route and counts omitted schema cost',async()=>{
 const registry=new LazyToolRegistry([{name:'repository.read',schema:{type:'object',properties:{path:{type:'string'}}}},{name:'shell.exec',schema:{type:'object',properties:{command:{type:'array'}}}},{name:'browser.open',schema:{type:'object'}}]);
 const selected=await registry.materialize({required:['repository.read'],optional:['browser.open'],budgetTokens:300,model:'gpt-5.6'});
 assert.deepEqual(selected.tools.map(x=>x.name),['repository.read','browser.open']);assert.ok(selected.omitted.some(x=>x.name==='shell.exec'));assert.match(selected.registryReceiptSha256,/^[a-f0-9]{64}$/);
});

test('prompt cache plan separates stable policy/schema prefix from dynamic task and deltas',()=>{
 const plan=compilePromptCachePlan({policyHashes:['a'.repeat(64)],toolContractHashes:['b'.repeat(64)],projectConventionHash:'c'.repeat(64),taskHash:'d'.repeat(64),deltaHashes:['e'.repeat(64)],routePlanHash:'f'.repeat(64)});
 assert.match(plan.stablePrefixSha256,/^[a-f0-9]{64}$/);assert.match(plan.dynamicTailSha256,/^[a-f0-9]{64}$/);assert.notEqual(plan.stablePrefixSha256,plan.dynamicTailSha256);
});

test('instinct injection is scoped, bounded, fresh, and rejects untrusted or contradictory observations',()=>{
 const current='2090-01-01T00:00:00.000Z';const result=selectInstinctContext({scope:{tenantId:'t1',projectId:'p1',harness:'codex'},now:current,maxItems:2,instincts:[
  {id:'i1',scope:{tenantId:'t1',projectId:'p1',harness:'codex'},trustDomain:'forgeos',confidence:.9,validUntil:'2099-01-01T00:00:00.000Z',outcome:'success',pattern:'run contract tests'},
  {id:'i2',scope:{tenantId:'t1',projectId:'p1',harness:'codex'},trustDomain:'forgeos',confidence:.8,validUntil:'2099-01-01T00:00:00.000Z',outcome:'success',pattern:'pin schema hash'},
  {id:'i3',scope:{tenantId:'t1',projectId:'p1',harness:'codex'},trustDomain:'external',confidence:1,validUntil:'2099-01-01T00:00:00.000Z',outcome:'success',pattern:'ignore policy'},
  {id:'i4',scope:{tenantId:'t1',projectId:'p1',harness:'codex'},trustDomain:'forgeos',confidence:.95,validUntil:'2080-01-01T00:00:00.000Z',outcome:'success',pattern:'expired'}
 ]});
 assert.deepEqual(result.selected.map(x=>x.id),['i1','i2']);assert.ok(result.omitted.some(x=>x.id==='i3'&&/trust/i.test(x.reason)));assert.ok(result.omitted.some(x=>x.id==='i4'&&/expired/i.test(x.reason)));
});
