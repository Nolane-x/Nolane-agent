import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpSession, handleMcpRpc } from '../src/server/mcp.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const names=['forge_federation_sources_list','forge_federation_sync_source','forge_capabilities_search','forge_capability_get','forge_providers_list','forge_provider_import','forge_skill_intake','forge_provider_scan','forge_provider_approval_request','forge_provider_promote','forge_bundle_resolve','forge_bundle_materialize','forge_mcp_search','forge_mcp_assess','forge_mcp_execute','forge_federation_audit'];
const capabilityRecord={
  capabilityId:'ui-design.audit-accessibility',title:'Audit accessibility',domain:'ui-design',discipline:'audit-accessibility',
  intentSignals:['accessibility audit'],consumes:['confirmed-intent'],produces:['accessibility-report'],evidence:['accessibility-receipt'],riskClass:'medium',
  knowledgeTopics:['wcag'],requiredTools:[],conflictTags:[],preferredSourceIds:['official'],knowledgePackId:'knowledge-pack.ui-design',knowledgeSourceIds:['w3c'],
  mcpCapabilities:[],qualityDimensions:['accessibility'],dependencies:[],deliveryModel:'federated-resolution',phase:'verification',ordinal:1,
  providerPolicy:{minimumTrust:60,allowLinkOnly:true,preferLocal:true},contextBudget:1000,
};
const providerRecord={
  providerId:'provider-1',capabilityId:capabilityRecord.capabilityId,sourceId:'official',sourceCoordinate:'release:v0.4.0#skill',contentDigest:'a'.repeat(64),
  kind:'skill',status:'quarantined',title:'Provider',license:{spdx:'MIT',mode:'vendor-allowed',ambiguous:false},trust:{score:70,blockers:[]},
  compatibility:{agents:['*'],tools:[]},providerDigest:'b'.repeat(64),material:{type:'external-agent-skill',files:[]},tenantId:'tenant-a',originalProviderId:'provider-1',
};
const bundleRecord={
  schemaVersion:1,bundleId:`bundle_${'c'.repeat(24)}`,bundleSha256:'d'.repeat(64),
  capability:{capabilityId:capabilityRecord.capabilityId,contractSha256:'e'.repeat(64),title:capabilityRecord.title,domain:capabilityRecord.domain,riskClass:'medium',consumes:capabilityRecord.consumes,produces:capabilityRecord.produces,evidence:capabilityRecord.evidence,requiredTools:[],mcpCapabilities:[],qualityDimensions:['accessibility'],dependencies:[],conflictTags:[],knowledgePackId:capabilityRecord.knowledgePackId,providerPolicy:capabilityRecord.providerPolicy,contextBudget:1000},
  selected:[],context:{budgetTokens:1000,estimatedTokens:0,remainingTokens:1000,withinBudget:true},
  execution:{agent:'codex',assurance:'A1',requiredTools:[],consumes:capabilityRecord.consumes,produces:capabilityRecord.produces,evidenceObligations:capabilityRecord.evidence,stopCondition:'Stop after verified output.'},
  approvalsRequired:[],conflicts:[],reasons:[],unresolved:[],
};
function federationMock(){return{
  listSources:async()=>[{id:'official',kind:'mcp-registry',authority:'official',trust:'verified',title:'Official registry',url:'https://registry.modelcontextprotocol.io',revision:'v0.1',license:{spdx:'MIT',mode:'link-only',ambiguous:false},domains:['all'],syncPolicy:{pinOnImport:true,maxAgeHours:24},notes:null}],
  syncSource:async(sourceId)=>({sourceId,revision:'0'.repeat(40),snapshotSha256:'f'.repeat(64),providers:[],findings:[],autoPromoted:false}),
  searchCapabilities:async()=>[{...capabilityRecord,score:50}],
  getCapability:async()=>capabilityRecord,
  listProviders:async()=>[providerRecord],
  importProvider:async()=>providerRecord,
  intakeSkillBundle:async()=>({provider:providerRecord,intake:{schemaVersion:1,status:'candidate',packageSha256:'9'.repeat(64),contentDigest:'a'.repeat(64),archiveSha256:'b'.repeat(64),license:{spdx:'MIT',mode:'vendor-allowed',ambiguous:false},estimatedTokens:42,findings:[],files:[]}}),
  scanProvider:async()=>({provider:providerRecord,scanReceipt:{id:'scan-1',status:'fail'}}),
  requestProviderApproval:async()=>({approval:{id:'approval-1',providerId:'provider-1',targetStatus:'candidate',token:'x'.repeat(32)}}),
  promote:async()=>({...providerRecord,status:'candidate'}),
  resolve:async()=>bundleRecord,
  materialize:async()=>({schemaVersion:1,bundleId:bundleRecord.bundleId,bundleSha256:bundleRecord.bundleSha256,capabilityId:capabilityRecord.capabilityId,materials:[],bytes:0,estimatedTokens:0,generatedAt:'2026-07-25T00:00:00.000Z',contextPackSha256:'1'.repeat(64)}),
  searchMcp:async()=>({servers:[],nextCursor:null}),
  assessMcp:(server)=>({server,status:'candidate',findings:[],permissions:[],trustScore:100}),
  executeMcp:async()=>({output:{ok:true},receipt:{schemaVersion:1,type:'mcp-tool-execution',providerId:'provider-1',providerDigest:'b'.repeat(64),toolName:'lookup',readOnly:true,tenantId:'tenant-a',principal:{id:'admin',type:'human',roles:['federation-admin'],trustDomain:'tenant-a'},inputSha256:'2'.repeat(64),outputSha256:'3'.repeat(64),status:'pass',errorCode:null,startedAt:'2026-07-25T00:00:00.000Z',completedAt:'2026-07-25T00:00:01.000Z',receiptSha256:'4'.repeat(64)}}),
  audit:async()=>({sourceCount:1,capabilityCount:1024,providerCount:1,builtInProviderCount:0,externalProviderCount:1,proceduralProviderCount:1,knowledgeProviderCount:0,statusCounts:{quarantined:1},catalogRevision:1,blockerCount:1}),
};}
async function readyContext(){const context={session:createMcpSession(),principal:createPrincipal({id:'admin',type:'human',roles:['federation-admin'],scopes:['*','approve'],trustDomain:'tenant-a'}),forge:{},federation:federationMock()};let r=await handleMcpRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}},context);assert.ok(r.result);await handleMcpRpc({jsonrpc:'2.0',method:'notifications/initialized'},context);return context;}

test('MCP advertises sixteen strict federation tools',async()=>{const context=await readyContext();const response=await handleMcpRpc({jsonrpc:'2.0',id:2,method:'tools/list'},context);const listed=response.result.tools.map(t=>t.name);for(const name of names)assert.ok(listed.includes(name),name);});

test('all federation tools execute through full MCP lifecycle with schema-valid results',async()=>{const context=await readyContext();const calls={
 forge_federation_sources_list:{},forge_federation_sync_source:{tenantId:'tenant-a',sourceId:'community-skills'},forge_capabilities_search:{query:'accessibility'},forge_capability_get:{capabilityId:'ui-design.audit-accessibility'},forge_providers_list:{tenantId:'tenant-a'},
 forge_provider_import:{tenantId:'tenant-a',provider:{providerId:'provider-1',capabilityId:'ui-design.audit-accessibility',sourceId:'official',sourceCoordinate:'mcp-registry:https://registry.modelcontextprotocol.io@v0.1',contentDigest:'a'.repeat(64),kind:'skill',title:'Provider',license:{spdx:'MIT',mode:'vendor-allowed'},trust:{score:70,blockers:[]},compatibility:{agents:['*'],tools:[]}}},
 forge_skill_intake:{tenantId:'tenant-a',providerId:'intake-provider',capabilityId:'ui-design.audit-accessibility',title:'Intake Provider',compatibility:{agents:['*'],tools:[]},riskClass:'medium',source:{sourceId:'intake-source',sourceCoordinate:'local-archive:intake.zip@sha256:'+('a'.repeat(64)),snapshotSha256:'a'.repeat(64),license:'MIT',permissions:[]},files:[{path:'SKILL.md',content:'---\nname: intake-provider\ndescription: Use when importing bounded external skill data.\n---\n# Intake'}]},
 forge_provider_scan:{tenantId:'tenant-a',providerId:'provider-1'},forge_provider_approval_request:{tenantId:'tenant-a',providerId:'provider-1',targetStatus:'candidate'},forge_provider_promote:{tenantId:'tenant-a',providerId:'provider-1',targetStatus:'candidate',approvalId:'approval-1',approvalToken:'x'.repeat(32),evaluationReceiptId:'a'.repeat(64)},
 forge_bundle_resolve:{tenantId:'tenant-a',capabilityId:'ui-design.audit-accessibility',agent:'codex',tools:[],allowExternal:false},forge_bundle_materialize:{tenantId:'tenant-a',bundle:bundleRecord},forge_mcp_search:{query:'github'},forge_mcp_assess:{server:{name:'safe',publisherVerified:true,remotes:[{url:'https://mcp.example.com'}],tools:[]}},forge_mcp_execute:{tenantId:'tenant-a',providerId:'provider-1',toolName:'lookup',arguments:{}},forge_federation_audit:{tenantId:'tenant-a'} };
 let id=10;for(const name of names){const response=await handleMcpRpc({jsonrpc:'2.0',id:id++,method:'tools/call',params:{name,arguments:calls[name]}},context);assert.notEqual(response.result?.isError,true,`${name}: ${JSON.stringify(response)}`);assert.ok(response.result?.structuredContent);}
});

test('federation tool schemas reject additional properties before side effects',async()=>{const context=await readyContext();const response=await handleMcpRpc({jsonrpc:'2.0',id:40,method:'tools/call',params:{name:'forge_capabilities_search',arguments:{query:'ui',unexpected:true}}},context);assert.equal(response.result.isError,true);assert.equal(response.result.structuredContent.error.code,'invalid_tool_arguments');});

test('federation MCP tool outputs reuse strict canonical provider, bundle, context, and receipt contracts',async()=>{
  const responseSchemas=new Map((await handleMcpRpc({jsonrpc:'2.0',id:99,method:'tools/list'},await readyContext())).result.tools.map((item)=>[item.name,item.outputSchema]));
  assert.equal(responseSchemas.get('forge_providers_list').properties.providers.items.additionalProperties,false);
  assert.equal(responseSchemas.get('forge_bundle_resolve').properties.bundle.additionalProperties,false);
  assert.equal(responseSchemas.get('forge_bundle_materialize').properties.contextPack.additionalProperties,false);
  assert.equal(responseSchemas.get('forge_mcp_execute').properties.receipt.additionalProperties,false);
});
