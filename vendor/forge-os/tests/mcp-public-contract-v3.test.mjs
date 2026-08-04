import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createMcpSession, handleMcpRpc } from '../src/server/mcp.mjs';

async function context(t){
  const root=await mkdtemp(path.join(tmpdir(),'forge-mcp-contract-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const ctx={forge:new ForgeOrchestrator(new ProjectStore(root)),baseUrl:'https://forge.example',principal:createPrincipal({id:'agent:mcp-contract',type:'agent',roles:['worker'],trustDomain:'team:build'}),session:createMcpSession()};
  await handleMcpRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'contract-test',version:'1'}}},ctx);
  await handleMcpRpc({jsonrpc:'2.0',method:'notifications/initialized'},ctx);
  return ctx;
}
async function call(ctx,id,name,args){
  const response=await handleMcpRpc({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}},ctx);
  assert.notEqual(response.result?.isError,true,JSON.stringify(response));
  return response.result.structuredContent;
}

test('export, route, and next-action conform to their advertised public output schemas',async(t)=>{
  const ctx=await context(t);
  const created=await call(ctx,2,'forge_project_create',{name:'MCP contract project',domain:'saas',assurance:'A0'});
  const projectId=created.project.id;
  const exported=await call(ctx,3,'forge_project_export',{projectId});
  assert.equal(exported.export.projectId,projectId);
  assert.equal(exported.export.fileName,`${projectId}.forge.json`);
  assert.match(exported.export.sha256,/^[a-f0-9]{64}$/);
  const routed=await call(ctx,4,'forge_skills_route',{projectId,tools:[]});
  assert.equal(routed.projectId,projectId);
  assert.ok(routed.plan===null||typeof routed.plan==='object');
  const next=await call(ctx,5,'forge_next_action',{projectId,tools:[]});
  assert.equal(next.projectId,projectId);
  assert.ok(next.plan===null||typeof next.plan==='object');
});
