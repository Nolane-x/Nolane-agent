import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createMcpSession, handleMcpRpc, WIDGET_URI } from '../src/server/mcp.mjs';

async function context(t){const dir=await mkdtemp(path.join(tmpdir(),'forge-mcp-'));t.after(()=>rm(dir,{recursive:true,force:true}));const ctx={forge:new ForgeOrchestrator(new ProjectStore(dir)),baseUrl:'https://forge.example',principal:createPrincipal({id:'agent:mcp',type:'agent',roles:['worker'],scopes:['*']}),session:createMcpSession()};await handleMcpRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}},ctx);await handleMcpRpc({jsonrpc:'2.0',method:'notifications/initialized'},ctx);return ctx;}

test('MCP advertises deterministic precise tools, prompts, and MCP App resource after lifecycle negotiation',async t=>{const ctx=await context(t);const tools=(await handleMcpRpc({jsonrpc:'2.0',id:2,method:'tools/list',params:{}},ctx)).result.tools;assert.ok(tools.length>=20);assert.deepEqual(tools.map(x=>x.name),[...tools.map(x=>x.name)].sort());assert.ok(tools.every(x=>x.inputSchema?.additionalProperties===false));const resources=await handleMcpRpc({jsonrpc:'2.0',id:3,method:'resources/list',params:{}},ctx);assert.equal(resources.result.resources[0].uri,WIDGET_URI);const resource=await handleMcpRpc({jsonrpc:'2.0',id:4,method:'resources/read',params:{uri:WIDGET_URI}},ctx);assert.match(resource.result.contents[0].text,/ForgeOS/);const prompts=await handleMcpRpc({jsonrpc:'2.0',id:5,method:'prompts/list',params:{}},ctx);assert.ok(prompts.result.prompts.length>=3);});

test('MCP tool calls return schema-validated structured content and widget metadata',async t=>{const ctx=await context(t);const created=await handleMcpRpc({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'forge_project_create',arguments:{name:'Demo',domain:'saas',assurance:'A1'}}},ctx);assert.ok(created.result.structuredContent.project.id);assert.equal(created.result._meta.ui.resourceUri,WIDGET_URI);const invalid=await handleMcpRpc({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'forge_project_create',arguments:{name:'Demo',injected:true}}},ctx);assert.equal(invalid.result.structuredContent.error.code,'invalid_tool_arguments');});

test('MCP unknown methods remain protocol errors while notifications remain silent',async t=>{const ctx=await context(t);const unknown=await handleMcpRpc({jsonrpc:'2.0',id:7,method:'unknown',params:{}},ctx);assert.equal(unknown.error.code,-32601);assert.equal(await handleMcpRpc({jsonrpc:'2.0',method:'unknown',params:{}},ctx),null);});


test('MCP tools/call fails closed when an embedded host omits authenticated principal',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forge-mcp-no-principal-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const ctx={forge:new ForgeOrchestrator(new ProjectStore(dir)),session:createMcpSession()};
  await handleMcpRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'embedded',version:'1'}}},ctx);
  await handleMcpRpc({jsonrpc:'2.0',method:'notifications/initialized'},ctx);
  const result=await handleMcpRpc({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'forge_project_create',arguments:{name:'Unauthorized'}}},ctx);
  assert.equal(result.result.structuredContent.error.code,'authenticated_principal_required');
  assert.equal((await ctx.forge.listProjects()).length,0);
});

test('MCP project mutations preserve authenticated principal provenance in project history', async (t) => {
  const ctx = await context(t);
  const created = await handleMcpRpc({jsonrpc:'2.0',id:10,method:'tools/call',params:{name:'forge_project_create',arguments:{name:'Provenance'}}},ctx);
  const projectId = created.result.structuredContent.project.id;
  await handleMcpRpc({jsonrpc:'2.0',id:11,method:'tools/call',params:{name:'forge_gate_run',arguments:{projectId}}},ctx);
  const project = await ctx.forge.getProject(projectId,{principal:ctx.principal});
  const event = [...project.history].reverse().find((item) => item.type === 'gate-run');
  assert.equal(event?.principal?.id, ctx.principal.id);
  assert.equal(event?.principal?.type, ctx.principal.type);
});
