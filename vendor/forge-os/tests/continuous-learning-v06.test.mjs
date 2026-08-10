import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {SqliteInstinctStore} from '../src/learning/instinct-store.mjs';
import {clusterInstincts} from '../src/learning/instinct-clusterer.mjs';
import {proposeSkillEvolution,promoteEvolution,rollbackEvolution} from '../src/learning/evolution-lab.mjs';
import {mineGitHistoryPatterns} from '../src/learning/git-history-miner.mjs';
import {mineToolTracePatterns} from '../src/learning/tool-trace-miner.mjs';

const service={id:'learning-service',type:'service',roles:['learning-observer'],trustDomain:'forgeos'};
const evaluator={id:'eval-service',type:'service',roles:['skill-evaluator'],trustDomain:'evaluation'};
const promoter={id:'maintainer-1',type:'human',roles:['skill-promoter'],trustDomain:'maintainers'};

test('instinct store is append only, scoped, expiring, and rejects caller-assigned stable maturity',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-instinct-'));const store=new SqliteInstinctStore(path.join(dir,'instinct.sqlite'));
 try{
  await assert.rejects(()=>store.observe({id:'i-bad',maturity:'stable',scope:{tenantId:'t1'},pattern:'always retry'}, {principal:service}),/maturity/i);
  const item=await store.observe({id:'instinct-001',scope:{tenantId:'t1',projectId:'p1',harness:'codex'},pattern:'Run contract tests after API schema changes',mechanism:'schema-change-requires-contract-test',confidence:0.72,validUntil:new Date(Date.now()+60_000).toISOString(),sourceReceipts:['a'.repeat(64)]},{principal:service});
  assert.equal(item.maturity,'observed');assert.match(item.instinctSha256,/^[a-f0-9]{64}$/);
  assert.equal((await store.list({tenantId:'t1',projectId:'p1',harness:'codex'})).length,1);
  assert.equal((await store.list({tenantId:'t2'})).length,0);
  await store.observe({id:'instinct-expired',scope:{tenantId:'t1'},pattern:'old pattern',mechanism:'old-pattern',confidence:0.9,validUntil:new Date(Date.now()-1_000).toISOString(),sourceReceipts:['b'.repeat(64)]},{principal:service});
  assert.equal((await store.list({tenantId:'t1'})).some(x=>x.id==='instinct-expired'),false);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('clustering is deterministic and never merges across tenant, trust domain, or contradictory outcome',()=>{
 const base={scope:{tenantId:'t1',projectId:'p1'},trustDomain:'forgeos',mechanism:'schema-change-requires-contract-test',confidence:0.8};
 const clusters=clusterInstincts([
  {...base,id:'i1',pattern:'run contract tests after schema edits',outcome:'success'},
  {...base,id:'i2',pattern:'schema edits need contract verification',outcome:'success'},
  {...base,id:'i3',pattern:'skip contract tests after schema edits',outcome:'failure'},
  {...base,id:'i4',scope:{tenantId:'t2'},pattern:'run contract tests',outcome:'success'},
 ]);
 assert.equal(clusters.length,3);
 assert.deepEqual(clusters.find(x=>x.instinctIds.includes('i1')).instinctIds,['i1','i2']);
 const reversed=clusterInstincts([...clusters.flatMap(c=>c.members)].reverse());
 assert.deepEqual(clusters.map(x=>x.clusterSha256),reversed.map(x=>x.clusterSha256));
});

test('evolution can only propose candidate, requires independent evaluation and human promotion, and supports rollback',()=>{
 const cluster={clusterId:'cluster-1',mechanism:'schema-change-requires-contract-test',instinctIds:['i1','i2','i3'],confidence:0.84,trustDomains:['forgeos'],clusterSha256:'c'.repeat(64)};
 const proposal=proposeSkillEvolution({baseSkill:{id:'testing-service-contracts',version:'1.2.0',contentSha256:'d'.repeat(64)},cluster});
 assert.equal(proposal.maturity,'candidate');assert.equal(proposal.version,'1.3.0');
 assert.throws(()=>promoteEvolution({proposal,evaluation:{status:'pass',lowerBound:0.12,evaluator,receiptSha256:'f'.repeat(64)},principal:{...promoter,trustDomain:'forgeos'}}),/independent|trust domain/i);
 const stable=promoteEvolution({proposal,evaluation:{status:'pass',lowerBound:0.12,evaluator,receiptSha256:'e'.repeat(64)},principal:promoter});
 assert.equal(stable.maturity,'stable');
 const rolled=rollbackEvolution({promotion:stable,reason:'holdout regression',principal:promoter});
 assert.equal(rolled.status,'rolled-back');assert.equal(rolled.restoredVersion,'1.2.0');
});

test('git history and tool trace miners output observed instincts, never skills or stable promotions',()=>{
 const git=mineGitHistoryPatterns({commits:[
  {id:'c1',files:['src/api.mjs','tests/api.test.mjs'],message:'fix schema regression',outcome:'success'},
  {id:'c2',files:['src/api.mjs','tests/api.test.mjs'],message:'fix schema validation',outcome:'success'},
  {id:'c3',files:['src/api.mjs'],message:'revert broken schema',outcome:'failure'},
 ]});
 assert.ok(git.every(x=>x.maturity==='observed'));
 const tools=mineToolTracePatterns({traces:[
  {taskClass:'test',calls:['read','test','test'],success:true,tokens:900},
  {taskClass:'test',calls:['read','test'],success:true,tokens:500},
  {taskClass:'test',calls:['read','search','test'],success:false,tokens:1200},
 ]});
 assert.ok(tools.some(x=>x.kind==='tool-sequence'));
 assert.ok(tools.every(x=>x.maturity==='observed'));
});
