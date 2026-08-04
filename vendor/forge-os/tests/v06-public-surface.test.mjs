import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {V06RuntimeService} from '../src/v06/service.mjs';
import {TOOL_BY_NAME,callForgeTool} from '../src/server/tool-registry.mjs';
import {createMcpSession,handleMcpRpc} from '../src/server/mcp.mjs';
import {createPrincipal} from '../src/core/principals.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('v0.6 runtime status reports deterministic fabric and 128 kernel techniques',async()=>{
  const service=new V06RuntimeService({root});
  const status=await service.status();
  assert.equal(status.version,'0.6.1');
  assert.equal(status.kernelTechniqueCount,128);
  assert.equal(status.l0TechniqueCount,32);
  assert.equal(status.l1TechniqueCount,96);
  assert.equal(status.executionGraphVersion,2);
  assert.equal(status.agentSurfaceAdversarial.passed,20);
  assert.equal(status.reviewBenchmark.cases,12);
});

test('v0.6 public tools are strict and dispatch through the shared service',async()=>{
  const names=['forge_v06_status','forge_execution_graph_compile','forge_review_scope_compile','forge_context_work_units_compile','forge_harness_profile_plan','forge_agent_surface_scan'];
  for(const name of names){
    const definition=TOOL_BY_NAME.get(name);
    assert.ok(definition,`${name} must be advertised`);
    assert.equal(definition.inputSchema.additionalProperties,false);
    assert.equal(definition.outputSchema.additionalProperties,false);
  }
  const service=new V06RuntimeService({root});
  const result=await callForgeTool('forge_v06_status',{},null,{v06:service});
  assert.equal(result.status.kernelTechniqueCount,128);
  const graph=await callForgeTool('forge_execution_graph_compile',{
    skillId:'resolving-user-intent',
    workUnits:[{unitId:'brief',files:['README.md']}],
    retryBudget:1,
  },null,{v06:service});
  assert.equal(graph.graph.workUnitIds[0],'brief');
  assert.match(graph.graph.graphSha256,/^[a-f0-9]{64}$/);
});

test('v0.6 context compiler isolates work units and records omissions',async()=>{
  const service=new V06RuntimeService({root});
  const result=await service.compileWorkUnitContexts({
    model:'fallback',hardInputLimit:4000,outputReserve:500,safetyReserve:500,
    shared:{system:'policy',task:'review',artifacts:[{id:'a',unitIds:['u1']},{id:'b',unitIds:['u2']}]},
    workUnits:[{unitId:'u1',files:['a.js'],skillSections:['procedure'],rules:['r1'],memory:[]}],
  });
  assert.equal(result.contexts.length,1);
  assert.equal(result.omissions.some(item=>item.id==='b'),true);
});


test('v0.6 tools execute through full MCP lifecycle',async()=>{
  const context={session:createMcpSession(),principal:createPrincipal({id:'agent:v06-test',type:'agent',roles:['worker'],trustDomain:'tenant-a'}),forge:{},v06:new V06RuntimeService({root})};
  await handleMcpRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'v06-test',version:'1'}}},context);
  await handleMcpRpc({jsonrpc:'2.0',method:'notifications/initialized'},context);
  const response=await handleMcpRpc({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'forge_v06_status',arguments:{}}},context);
  assert.notEqual(response.result?.isError,true,JSON.stringify(response));
  assert.equal(response.result.structuredContent.status.kernelTechniqueCount,128);
});
