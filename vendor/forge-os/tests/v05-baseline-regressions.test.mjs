import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBuiltInProviders } from '../src/federation/local-provider-seed.mjs';
import { loadCapabilityCatalog } from '../src/federation/capability-catalog.mjs';
import { compileCapabilityExecutionBundle } from '../src/federation/resolver.mjs';
import { materializeCapabilityBundle } from '../src/federation/materializer.mjs';

const root = new URL('../', import.meta.url).pathname;

async function releasedState(){
  return {providers: await loadBuiltInProviders(), capabilities: await loadCapabilityCatalog()};
}

test('every current stable procedural provider has a standard bundle that materializes within one shared budget', async () => {
  const {providers,capabilities}=await releasedState();
  const stable=providers.filter((provider)=>provider.kind==='skill'&&provider.status==='stable');
  const failures=[];
  for(const provider of stable){
    const capability=capabilities.find((item)=>item.capabilityId===provider.capabilityId);
    const bundle=compileCapabilityExecutionBundle(capability,{agent:'generic',tools:[...new Set([...(provider.compatibility?.tools??[]),...(capability.requiredTools??[])])],allowExternal:false,activeProviders:[],assurance:'A1'},providers);
    try{await materializeCapabilityBundle(bundle,{providers,root,maxBytes:512_000});}
    catch(error){failures.push({providerId:provider.providerId,capabilityId:capability.capabilityId,message:error.message});}
  }
  assert.equal(stable.length,33);
  assert.deepEqual(failures,[]);
});

test('released stable skill mappings are explicit many-to-many mappings rather than greedy unused-slot assignments', async () => {
  const {providers}=await releasedState();
  const mapped=Object.fromEntries(providers.filter((p)=>p.kind==='skill'&&p.status==='stable').map((p)=>[p.providerId,p.capabilityIds??[p.capabilityId]]));
  assert.ok(mapped['local-skill.designing-api-contracts'].some((id)=>/api|contract/.test(id)));
  assert.ok(mapped['local-skill.packaging-release-evidence'].some((id)=>/release|evidence/.test(id)));
  assert.ok(mapped['local-skill.selecting-winning-concept'].some((id)=>/concept|selection/.test(id)));
  assert.ok(mapped['local-skill.routing-skill-graph'].some((id)=>/routing|route/.test(id)));
  assert.ok(mapped['local-skill.resolving-user-intent'].some((id)=>/intent/.test(id)));
  assert.ok(mapped['local-skill.reviewing-critical-code-line-by-line'].some((id)=>/review/.test(id)));
});

test('an unresolved execution bundle cannot be materialized', async () => {
  const {providers,capabilities}=await releasedState();
  const capability=capabilities.find((item)=>item.capabilityId==='frontend-engineering.map-landscape');
  const bundle=compileCapabilityExecutionBundle(capability,{agent:'generic',tools:[],allowExternal:false,activeProviders:[],assurance:'A1'},providers.filter((p)=>p.capabilityId!==capability.capabilityId));
  assert.ok(bundle.unresolved.length>0);
  await assert.rejects(()=>materializeCapabilityBundle(bundle,{providers,root}),/unresolved|not executable/i);
});

test('capability required tools and preferred sources are enforced during provider resolution', async () => {
  const capability={capabilityId:'test.cap',title:'Test',domain:'frontend-engineering',riskClass:'medium',consumes:[],produces:['x'],evidence:['e'],requiredTools:['browser-profiler'],mcpCapabilities:[],providerPolicy:{minimumTrust:1,allowLinkOnly:true,preferLocal:false},preferredSourceIds:['preferred'],contextBudget:5000};
  const base={capabilityId:'test.cap',kind:'skill',status:'stable',trust:{score:90,blockers:[]},license:{mode:'vendor-allowed'},compatibility:{agents:['*'],tools:[]},estimatedTokens:100,conflicts:[],contentDigest:'a'.repeat(64)};
  const providers=[
    {...base,providerId:'other',providerDigest:'1'.repeat(64),sourceId:'other',sourceCoordinate:'release:x',title:'Other'},
    {...base,providerId:'preferred',providerDigest:'2'.repeat(64),sourceId:'preferred',sourceCoordinate:'release:y',title:'Preferred'},
  ];
  const blocked=compileCapabilityExecutionBundle(capability,{agent:'generic',tools:[],allowExternal:true,activeProviders:[],assurance:'A1'},providers);
  assert.match(blocked.unresolved.join(' '),/browser-profiler|required tool/i);
  const allowed=compileCapabilityExecutionBundle(capability,{agent:'generic',tools:['browser-profiler'],allowExternal:true,activeProviders:[],assurance:'A1'},providers);
  assert.equal(allowed.selected[0].providerId,'preferred');
});
