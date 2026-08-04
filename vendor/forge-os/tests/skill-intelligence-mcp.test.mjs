import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpSession, handleMcpRpc } from '../src/server/mcp.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { SkillIntelligenceService } from '../src/intelligence/service.mjs';

async function ready(){
 const context={session:createMcpSession(),principal:createPrincipal({id:'agent:intelligence-test',type:'agent',roles:['worker'],trustDomain:'tenant-a'}),forge:{},intelligence:new SkillIntelligenceService()};
 await handleMcpRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'skill-intelligence-test',version:'1'}}},context);
 await handleMcpRpc({jsonrpc:'2.0',method:'notifications/initialized'},context);
 return context;
}
async function call(context,id,name,args){
 const response=await handleMcpRpc({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}},context);
 assert.notEqual(response.result?.isError,true,JSON.stringify(response));
 return response.result.structuredContent;
}

test('MCP advertises strict Skill Intelligence v2 tools',async()=>{
 const context=await ready();
 const names=new Set();let cursor;let id=2;
 do{const response=await handleMcpRpc({jsonrpc:'2.0',id:id++,method:'tools/list',params:{...(cursor?{cursor}:{})}},context);for(const item of response.result.tools)names.add(item.name);cursor=response.result.nextCursor;}while(cursor);
 for(const name of ['forge_intelligence_route','forge_intelligence_status','forge_skill_v2_inspect','forge_skill_v2_materialize','forge_context_compile','forge_fabric_scope','forge_eval_v2_manifest']) assert.ok(names.has(name),name);
});

test('Skill Intelligence routes, inspects, materializes, and compiles bounded context through full MCP lifecycle',async()=>{
 const context=await ready();
 const routed=await call(context,2,'forge_intelligence_route',{query:'Design a versioned API contract for a public SDK',domains:['api-integration'],taskClass:'architecture',model:'gpt-5.6',tools:['api-client'],assurance:'A2',operation:'planning'});
 assert.equal(routed.routePlan.steps[0].techniqueId,'technique.designing-api-contracts');
 assert.match(routed.routePlan.routePlanSha256,/^[a-f0-9]{64}$/);
 const inspected=await call(context,3,'forge_skill_v2_inspect',{skillId:'resolving-user-intent'});
 assert.equal(inspected.skill.id,'resolving-user-intent');
 assert.equal(inspected.skill.kernelLevel,'L0');
 assert.equal(Object.hasOwn(inspected.skill,'body'),false);
 const materialized=await call(context,4,'forge_skill_v2_materialize',{skillId:'resolving-user-intent',sections:['overview','procedure'],model:'gpt-5.6'});
 assert.deepEqual(materialized.contextPack.sections.map((item)=>item.id),['overview','procedure']);
 assert.ok(!materialized.contextPack.text.includes('# Evaluation Scenarios'));
 const compiled=await call(context,5,'forge_context_compile',{model:'gpt-5.6',policy:{modelContextLimit:6000,hardInputLimit:4000,outputReserve:1000,safetyReserve:500,budgets:{system:500,task:500,skills:800,code:600,artifacts:400,memory:300,toolOutput:300,references:100}},inputs:{system:['system'],task:['task'],skills:[{id:'selected-skill',text:materialized.contextPack.text,required:true}],references:[{id:'large-ref',text:'x '.repeat(500),priority:1}]}});
 assert.ok(compiled.context.contextReceiptSha256);
 assert.ok(compiled.context.omissions.some((item)=>item.sourceId==='large-ref'));
});

test('deterministic scope and evaluator manifests are public without exposing holdout prompts',async()=>{
 const context=await ready();
 const scoped=await call(context,2,'forge_fabric_scope',{files:[{path:'src/a.mjs',sha256:'a'.repeat(64)},{path:'docs/a.md',sha256:'b'.repeat(64)}],include:['src/**'],exclude:[]});
 assert.deepEqual(scoped.scope.included.map((item)=>item.path),['src/a.mjs']);
 assert.deepEqual(scoped.scope.excluded.map((item)=>item.path),['docs/a.md']);
 const evaluated=await call(context,3,'forge_eval_v2_manifest',{skillId:'resolving-user-intent'});
 assert.equal(evaluated.evaluation.skillId,'resolving-user-intent');
 assert.ok(evaluated.evaluation.publicCaseCount>=2);
 assert.equal(Object.hasOwn(evaluated.evaluation,'holdoutPrompts'),false);
});
