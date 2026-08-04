import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCapabilityExecutionBundle } from '../src/federation/resolver.mjs';

const capability={
  capabilityId:'ui-design.audit-accessibility',
  domain:'ui-design',discipline:'quality-assurance',title:'Audit accessibility',
  intentSignals:['audit accessibility'],knowledgeTopics:['WCAG'],
  consumes:['interface-implementation'],produces:['accessibility-audit'],evidence:['accessibility-report'],
  requiredTools:['browser'],conflictTags:['ui-exclusive-reviewer'],preferredSourceIds:['forgeos-local'],
  knowledgePackId:'knowledge.ui-design',knowledgeSourceIds:['w3c-wcag'],mcpCapabilities:['browser.inspect'],
  qualityDimensions:['accessibility','correctness'],dependencies:[],deliveryModel:'federated-resolution',phase:'verification',ordinal:1,
  providerPolicy:{minimumTrust:60,preferLocal:true,allowLinkOnly:true},contextBudget:2400,riskClass:'high',
};
const providers=[
  {providerId:'skill.local',providerDigest:'1'.repeat(64),contentDigest:'a'.repeat(64),capabilityId:capability.capabilityId,kind:'skill',status:'stable',sourceId:'forgeos-local',sourceCoordinate:'local://skill',title:'Local audit',trust:{score:85,blockers:[]},license:{spdx:'MIT',mode:'vendor-allowed'},compatibility:{agents:['codex'],tools:['browser']},estimatedTokens:900,conflicts:[],material:{body:'must not leak'}},
  {providerId:'knowledge.w3c',providerDigest:'2'.repeat(64),contentDigest:'b'.repeat(64),capabilityId:capability.capabilityId,kind:'knowledge',status:'stable',sourceId:'w3c-wcag',sourceCoordinate:'https://w3.org/WAI/WCAG22',title:'WCAG',trust:{score:100,blockers:[]},license:{spdx:'W3C-Document',mode:'link-only'},compatibility:{agents:['*'],tools:[]},estimatedTokens:300,conflicts:[]},
  {providerId:'mcp.browser',providerDigest:'3'.repeat(64),contentDigest:'c'.repeat(64),capabilityId:capability.capabilityId,kind:'mcp',status:'stable',sourceId:'mcp-official-registry',sourceCoordinate:'mcp://browser',title:'Browser MCP',trust:{score:90,blockers:[]},license:{spdx:'Apache-2.0',mode:'link-only'},compatibility:{agents:['codex'],tools:['browser']},estimatedTokens:120,conflicts:[],material:{server:{tools:[{name:'inspect'}]}}},
  {providerId:'skill.candidate',providerDigest:'4'.repeat(64),contentDigest:'d'.repeat(64),capabilityId:capability.capabilityId,kind:'skill',status:'candidate',sourceId:'community',sourceCoordinate:'https://example.com@commit',title:'Candidate',trust:{score:95,blockers:[]},license:{spdx:'MIT',mode:'vendor-allowed'},compatibility:{agents:['codex'],tools:['browser']},estimatedTokens:500,conflicts:[]},
];

test('execution bundle freezes capability and provider contracts without loading provider bodies',()=>{
  const bundle=compileCapabilityExecutionBundle(capability,{agent:'codex',tools:['browser'],allowExternal:true,activeProviders:[],assurance:'A2'},providers);
  assert.match(bundle.bundleId,/^bundle_[a-f0-9]{24}$/);
  assert.match(bundle.bundleSha256,/^[a-f0-9]{64}$/);
  assert.match(bundle.capability.contractSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(bundle.capability.consumes,['interface-implementation']);
  assert.deepEqual(bundle.capability.produces,['accessibility-audit']);
  assert.deepEqual(bundle.capability.evidence,['accessibility-report']);
  assert.deepEqual(bundle.selected.map((item)=>item.providerId),['skill.local','knowledge.w3c','mcp.browser']);
  assert.ok(bundle.selected.every((item)=>!('material' in item)&&!('body' in item)));
  assert.equal(bundle.context.estimatedTokens,1320);
  assert.equal(bundle.context.remainingTokens,1080);
  assert.equal(bundle.context.withinBudget,true);
  assert.ok(bundle.approvalsRequired.some((item)=>item.providerId==='skill.candidate'));
  assert.equal(bundle.execution.stopCondition,'accessibility-audit produced and accessibility-report receipt verified');
  assert.deepEqual(bundle.execution.requiredTools,['browser']);
  assert.equal(bundle.conflicts.length,0);
  assert.throws(()=>{bundle.selected.push({});},TypeError);
});

test('execution bundle reports conflicts, missing provider classes, and budget overflow rather than hiding them',()=>{
  const conflicting={...providers[0],providerId:'skill.conflict',providerDigest:'5'.repeat(64),sourceId:'community',conflicts:['active-reviewer'],estimatedTokens:2500};
  const bundle=compileCapabilityExecutionBundle(capability,{agent:'codex',tools:['browser'],allowExternal:true,activeProviders:['active-reviewer'],assurance:'A3'},[conflicting]);
  assert.ok(bundle.conflicts.some((item)=>item.providerId==='skill.conflict'));
  assert.ok(bundle.unresolved.includes('No stable trusted procedural provider is currently available'));
  assert.ok(bundle.unresolved.includes('No stable knowledge provider is currently available'));
  assert.ok(bundle.unresolved.includes('No stable MCP provider is currently available'));
  assert.equal(bundle.context.withinBudget,true);
});
