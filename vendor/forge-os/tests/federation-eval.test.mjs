import test from 'node:test';import assert from 'node:assert/strict';
import { evaluateFederatedProvider, auditFederationGraph } from '../src/evals/federation-evaluator.mjs';
import { loadCapabilityCatalog } from '../src/federation/capability-catalog.mjs';
import { loadKnowledgePacks, validateKnowledgePacks } from '../src/federation/knowledge-packs.mjs';

test('knowledge federation contains 32 authoritative reference-only packs covering all 1,024 capabilities',async()=>{const capabilities=await loadCapabilityCatalog({refresh:true});const packs=await loadKnowledgePacks({refresh:true});const report=validateKnowledgePacks(packs,capabilities);assert.equal(packs.length,32);assert.deepEqual(report.errors,[]);assert.equal(new Set(packs.flatMap(p=>p.capabilities)).size,1024);});

test('provider evaluator quarantines stale, malicious, mismatched, or regressing providers and hashes the receipt',()=>{const now=Date.parse('2026-07-25T00:00:00Z');const provider={providerId:'p',providerDigest:'a'.repeat(64),capabilityId:'ui-design.audit-accessibility',observedAt:'2026-05-01T00:00:00Z',trust:{blockers:['instruction-override']}};const receipt=evaluateFederatedProvider({provider,capability:{capabilityId:'other'},scanReceipt:{status:'pass',providerDigest:provider.providerDigest},baseline:{passRate:.8,quality:80,tokens:1000},candidate:{passRate:.7,quality:75,tokens:2000},now});assert.equal(receipt.status,'fail');assert.match(receipt.findings.map(f=>f.code).join(','),/source-stale|trust-blockers|quality-regression|capability-mismatch/);assert.match(receipt.receiptSha256,/^[a-f0-9]{64}$/);});

test('federation self-audit reports duplicates, gaps, stale sources, blockers, and honest capability claims',()=>{const capabilities=[{capabilityId:'a',knowledgePackId:'pack.a'},{capabilityId:'b',knowledgePackId:'pack.b'}];const providers=[{providerId:'p1',capabilityId:'a',sourceId:'s',observedAt:'2026-01-01',trust:{blockers:[]},title:'Same',kind:'skill',compatibility:{tools:[]},contentDigest:'a'.repeat(64)},{providerId:'p2',capabilityId:'a',sourceId:'missing',observedAt:'2026-01-01',trust:{blockers:['bad']},title:'Same',kind:'skill',compatibility:{tools:[]},contentDigest:'b'.repeat(64)}];const report=auditFederationGraph({capabilities,providers,sources:[{id:'s'}],knowledgePacks:[{id:'pack.a'}],now:Date.parse('2026-07-25')});assert.equal(report.summary.missingProviderCount,1);assert.equal(report.summary.staleProviderCount,2);assert.equal(report.summary.blockerCount,1);assert.equal(report.summary.missingKnowledgeCount,1);assert.equal(report.claims.federatedCapabilities,2);assert.equal(report.claims.externalProvidersImported,2);});

test('self-audit separates built-in knowledge coverage from stable procedural and external provider coverage', async () => {
  const { buildBuiltInProviders } = await import('../src/federation/local-provider-seed.mjs');
  const capabilities = await loadCapabilityCatalog();
  const knowledgePacks = await loadKnowledgePacks();
  const providers = await buildBuiltInProviders();
  const report = auditFederationGraph({ capabilities, providers, sources: [{ id: 'forgeos-local' }], knowledgePacks, now: Date.parse('2026-07-25') });

  assert.equal(report.summary.missingProviderCount, 0);
  assert.equal(report.summary.missingKnowledgeProviderCount, 0);
  assert.equal(report.summary.missingProceduralProviderCount, 832);
  assert.equal(report.summary.missingStableProceduralProviderCount, 978);
  assert.equal(report.summary.staleProviderCount, 0);
  assert.equal(report.claims.firstPartySkills, 275);
  assert.equal(report.claims.stableFirstPartySkills, 33);
  assert.equal(report.claims.candidateFirstPartySkills, 242);
  assert.equal(report.claims.builtInProviderMappings, 1299);
  assert.equal(report.claims.externalProvidersImported, 0);
});
