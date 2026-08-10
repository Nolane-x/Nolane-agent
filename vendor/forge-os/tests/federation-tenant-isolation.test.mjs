import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FederationCatalogStore } from '../src/federation/catalog-store.mjs';
import { FederationService } from '../src/federation/service.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const principal=(tenant)=>createPrincipal({id:`admin-${tenant}`,type:'human',roles:['federation-admin'],scopes:[`tenant:${tenant}`],trustDomain:`issuer/${tenant}`});
const provider=(id)=>({providerId:id,capabilityId:'ui-design.audit-accessibility',sourceId:'community-skills',sourceCoordinate:'https://github.com/example/skills@0123456789abcdef0123456789abcdef01234567#skill',contentDigest:'a'.repeat(64),kind:'skill',title:'Tenant skill',license:{spdx:'MIT',mode:'vendor-allowed'},trust:{score:70,blockers:[]},compatibility:{agents:['*'],tools:[]},material:{type:'external-agent-skill',files:[{path:'SKILL.md',content:'# Skill'}]}});

test('external providers are tenant-scoped while built-in providers remain globally readable',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-fed-tenant-'));
  const service=new FederationService({catalogStore:new FederationCatalogStore(root),builtInProviderLoader:async()=>[]});
  const a=await service.importProvider(provider('same-id'),{principal:principal('tenant-a'),tenantId:'tenant-a'});
  const b=await service.importProvider(provider('same-id'),{principal:principal('tenant-b'),tenantId:'tenant-b'});
  assert.notEqual(a.providerId,b.providerId,'storage IDs must not collide across tenants');
  const listA=await service.listProviders({tenantId:'tenant-a'},{principal:principal('tenant-a')});
  const listB=await service.listProviders({tenantId:'tenant-b'},{principal:principal('tenant-b')});
  assert.deepEqual(listA.map((item)=>item.tenantId),['tenant-a']);
  assert.deepEqual(listB.map((item)=>item.tenantId),['tenant-b']);
  assert.ok(!listA.some((item)=>item.providerId===b.providerId));
  await assert.rejects(()=>service.scanProvider(b.providerId,{tenantId:'tenant-a',principal:principal('tenant-a')}),/unknown provider|tenant/i);
  service.close();
});

test('public provider listing and federation audit enforce the requested tenant against the caller principal', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-fed-public-tenant-'));
  const service=new FederationService({catalogStore:new FederationCatalogStore(root),builtInProviderLoader:async()=>[]});
  const adminA=principal('tenant-a');
  const adminB=principal('tenant-b');
  await service.importProvider(provider('provider-a'),{principal:adminA,tenantId:'tenant-a'});
  await service.importProvider(provider('provider-b'),{principal:adminB,tenantId:'tenant-b'});
  await assert.rejects(()=>service.listProviders({tenantId:'tenant-b'},{principal:adminA}),/tenant scope denied|authorized/i);
  await assert.rejects(()=>service.audit({tenantId:'tenant-b'},{principal:adminA}),/tenant scope denied|authorized/i);
  const visible=await service.listProviders({tenantId:'tenant-a'},{principal:adminA});
  assert.deepEqual(visible.map((item)=>item.tenantId),['tenant-a']);
  const audit=await service.audit({tenantId:'tenant-a'},{principal:adminA});
  assert.equal(audit.externalProviderCount,1);
  service.close();
});

test('bundle resolution is tenant-authorized and built-in providers are immutable to tenant administrators', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-fed-resolve-tenant-'));
  const builtIn={...provider('built-in'),providerId:'built-in-provider',status:'stable',builtIn:true,tenantId:'global',material:{type:'local-agent-skill',path:'skills/core/kernel/using-forge-os/SKILL.md'}};
  const service=new FederationService({
    catalogStore:new FederationCatalogStore(root),
    builtInProviderLoader:async()=>[builtIn],
    capabilityLoader:async()=>[{capabilityId:'ui-design.audit-accessibility',title:'Audit accessibility',domain:'ui-design',discipline:'audit-accessibility',intentSignals:['audit'],consumes:['confirmed-intent'],produces:['report'],evidence:['receipt'],riskClass:'medium',knowledgeTopics:['wcag'],requiredTools:[],conflictTags:[],preferredSourceIds:['forgeos-local'],knowledgePackId:'knowledge-pack.ui-design',knowledgeSourceIds:[],mcpCapabilities:[],qualityDimensions:['accessibility'],dependencies:[],deliveryModel:'federated-resolution',phase:'verification',ordinal:1,providerPolicy:{minimumTrust:60,allowLinkOnly:true,preferLocal:true},contextBudget:1000}],
  });
  const adminA=principal('tenant-a');
  await service.initialize();
  await assert.rejects(()=>service.resolve({tenantId:'tenant-b',capabilityId:'ui-design.audit-accessibility'},{principal:adminA}),/tenant scope denied|authorized/i);
  await assert.rejects(()=>service.scanProvider('built-in-provider',{tenantId:'tenant-a',principal:adminA}),/built-in|immutable|system/i);
  service.close();
});
