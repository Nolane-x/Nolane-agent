import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FederationCatalogStore } from '../src/federation/catalog-store.mjs';
import { issueFederationApproval, promoteProvider, quarantineProvider } from '../src/federation/promotion.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const human=createPrincipal({id:'admin',type:'human',roles:['federation-admin'],scopes:['approve','federation:admin'],trustDomain:'org'});
const provider={providerId:'provider.x',providerDigest:'a'.repeat(64),capabilityId:'x.cap',status:'quarantined',trust:{score:90,blockers:[]},license:{mode:'vendor-allowed'},expiresAt:new Date(Date.now()+3600000).toISOString()};

test('federation catalog is revisioned and promotion cannot skip candidate state or use stale approval', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'forge-fed-'));
  try{
    const store=new FederationCatalogStore(dir); await store.initialize();
    await store.importProvider(provider);
    const {record,token}=issueFederationApproval(provider,'candidate',human);
    const candidate=promoteProvider(provider,{targetStatus:'candidate',scanReceipt:{status:'pass',providerDigest:provider.providerDigest},evaluationReceipt:{status:'pass',providerDigest:provider.providerDigest,qualityDelta:0.1},approval:record,token,principal:human});
    await store.replaceProvider(candidate,{expectedRevision:1});
    assert.equal((await store.read()).providers[0].status,'candidate');
    assert.throws(()=>promoteProvider(provider,{targetStatus:'stable',scanReceipt:{status:'pass',providerDigest:provider.providerDigest},evaluationReceipt:{status:'pass',providerDigest:provider.providerDigest},approval:record,token,principal:human}));
    const {record:stableApproval,token:stableToken}=issueFederationApproval(candidate,'stable',human);
    const stable=promoteProvider(candidate,{targetStatus:'stable',scanReceipt:{status:'pass',providerDigest:provider.providerDigest},evaluationReceipt:{status:'pass',providerDigest:provider.providerDigest,qualityDelta:0.1},approval:stableApproval,token:stableToken,principal:human});
    await store.replaceProvider(stable,{expectedRevision:2});
    assert.equal((await store.read()).providers[0].status,'stable');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('blockers force quarantine and status transitions remain append-only', () => {
  const quarantined=quarantineProvider({...provider,status:'candidate'},{code:'prompt-injection',severity:'blocker'});
  assert.equal(quarantined.status,'quarantined');
  assert.ok(quarantined.statusHistory.length>=1);
  assert.throws(()=>promoteProvider({...provider,trust:{score:90,blockers:['prompt-injection']}},{targetStatus:'candidate'}));
});
