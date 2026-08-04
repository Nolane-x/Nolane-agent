import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCapabilityBundle, routeFederatedCapabilities } from '../src/federation/resolver.mjs';

const capability={capabilityId:'ui-design.audit-accessibility',domain:'ui-design',title:'Audit accessibility',intentSignals:['keyboard screen reader'],knowledgeTopics:['WCAG'],requiredTools:['browser'],preferredSourceIds:['forgeos-local'],providerPolicy:{minimumTrust:60,preferLocal:true,allowLinkOnly:true},contextBudget:2400,riskClass:'medium'};
const providers=[
  {providerId:'local',capabilityId:capability.capabilityId,kind:'skill',status:'stable',sourceId:'forgeos-local',trust:{score:80,blockers:[]},license:{mode:'vendor-allowed'},compatibility:{agents:['codex'],tools:['browser']},estimatedTokens:900,conflicts:[]},
  {providerId:'external',capabilityId:capability.capabilityId,kind:'skill',status:'stable',sourceId:'vendor',trust:{score:95,blockers:[]},license:{mode:'vendor-allowed'},compatibility:{agents:['codex'],tools:['browser']},estimatedTokens:1100,conflicts:[]},
  {providerId:'knowledge',capabilityId:capability.capabilityId,kind:'knowledge',status:'stable',sourceId:'w3c',trust:{score:100,blockers:[]},license:{mode:'link-only'},compatibility:{agents:['*'],tools:[]},estimatedTokens:250,conflicts:[]},
];

test('resolver selects a minimal local-first bundle with authoritative knowledge and explains the choice', () => {
  const result=resolveCapabilityBundle(capability,{agent:'codex',tools:['browser'],activeProviders:[],allowExternal:true},providers);
  assert.deepEqual(result.providers.map((p)=>p.providerId),['local','knowledge']);
  assert.equal(result.totalEstimatedTokens,1150);
  assert.ok(result.reasons.some((reason)=>reason.includes('local-first')));
  assert.equal(result.approvalsRequired.length,0);
});

test('resolver never auto-enables candidate or conflicting providers', () => {
  const candidate={...providers[1],providerId:'candidate',status:'candidate'};
  const conflict={...providers[1],providerId:'conflict',conflicts:['already-active']};
  const result=resolveCapabilityBundle(capability,{agent:'codex',tools:['browser'],activeProviders:['already-active'],allowExternal:true},[candidate,conflict,providers[2]]);
  assert.deepEqual(result.providers.map((p)=>p.providerId),['knowledge']);
  assert.ok(result.approvalsRequired.some((item)=>item.providerId==='candidate'));
  assert.ok(result.unresolved.some((item)=>item.includes('trusted procedural')));
});

test('federated capability routing uses intent, domain, risk, and tools without loading provider bodies', () => {
  const catalog=[capability,{...capability,capabilityId:'cybersecurity.model-threats',domain:'cybersecurity',title:'Model security threats',intentSignals:['threat model supply chain'],knowledgeTopics:['security'],requiredTools:[],riskClass:'high'}];
  const routes=routeFederatedCapabilities(catalog,{query:'threat model supply chain',domain:'cybersecurity',tools:[],findings:[{severity:'critical',category:'security',status:'open'}]});
  assert.equal(routes[0].capabilityId,'cybersecurity.model-threats');
  assert.ok(!('body' in routes[0]));
});
