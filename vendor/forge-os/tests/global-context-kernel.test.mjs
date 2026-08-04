import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDefaultTokenAccountingRegistry } from '../src/context/token-accounting.mjs';
import { compileGlobalContext } from '../src/context/context-compiler.mjs';
import { projectArtifacts } from '../src/context/artifact-projector.mjs';
import { TieredMemoryManager } from '../src/context/memory-manager.mjs';
import { distillToolOutput } from '../src/context/tool-output-distiller.mjs';
import { BlobStore } from '../src/storage/blob-store.mjs';
import { buildSemanticAbi, fetchSemanticSymbol } from '../src/context/semantic-abi.mjs';

function policy(){return {modelContextLimit:12000,hardInputLimit:8000,outputReserve:1800,safetyReserve:700,budgets:{system:900,task:650,skills:1800,code:1800,artifacts:1100,memory:600,toolOutput:650,references:400}};}

test('global context compiler enforces one request budget and records every omission',async()=>{
 const registry=createDefaultTokenAccountingRegistry();
 const compiled=await compileGlobalContext({model:'gpt-5.6',policy:policy(),tokenRegistry:registry,inputs:{system:['system policy '.repeat(40)],task:['task '.repeat(35)],skills:[{id:'s1',text:'procedure '.repeat(350),priority:100},{id:'s2',text:'example '.repeat(350),priority:10}],code:[{id:'F1',text:'function x(){}'.repeat(200),priority:90}],artifacts:[{id:'A1',text:'artifact '.repeat(220),priority:80}],memory:[{id:'M1',text:'memory '.repeat(150),priority:50}],toolOutput:[{id:'T1',text:'log '.repeat(300),priority:70}],references:[{id:'R1',text:'reference '.repeat(180),priority:30}]}});
 assert.ok(compiled.accounting.totalInputTokens<=compiled.budget.availableInput);
 assert.ok(compiled.omissions.length>0);
 assert.equal(compiled.accounting.totalInputTokens,Object.values(compiled.accounting.categories).reduce((a,b)=>a+b,0));
 const omittedIds=new Set(compiled.omissions.map((item)=>item.sourceId));
 const includedIds=new Set(Object.values(compiled.context).flat().map((item)=>item.id));
 for(const id of ['s1','s2','F1','A1','M1','T1','R1']) assert.ok(omittedIds.has(id)||includedIds.has(id),`missing accounting for ${id}`);
 assert.match(compiled.contextReceiptSha256,/^[a-f0-9]{64}$/);
});

test('artifact projector enforces direct artifact and reference depth limits with a delta receipt',()=>{
 const artifacts=[
  {id:'A',type:'thesis',version:2,sha256:'a'.repeat(64),content:{x:2},consumes:['B']},
  {id:'B',type:'architecture',version:1,sha256:'b'.repeat(64),content:{x:1},consumes:['C']},
  {id:'C',type:'research',version:1,sha256:'c'.repeat(64),content:{x:1},consumes:[]},
  {id:'D',type:'plan',version:1,sha256:'d'.repeat(64),content:{x:1},consumes:[]}
 ];
 const projection=projectArtifacts({artifacts,requestedIds:['A','D'],checkpoint:{A:'0'.repeat(64),B:'b'.repeat(64)},maxDirectArtifacts:1,maxReferenceDepth:1});
 assert.deepEqual(projection.direct.map(x=>x.id),['A']);
 assert.deepEqual(projection.references.map(x=>x.id),['B']);
 assert.ok(!projection.references.some(x=>x.id==='C'));
 assert.ok(projection.omissions.some(x=>x.sourceId==='D'&&/maxDirectArtifacts/.test(x.reason)));
 assert.ok(projection.omissions.some(x=>x.sourceId==='C'&&/maxReferenceDepth/.test(x.reason)));
 assert.ok(projection.delta.changed.some(x=>x.id==='A'));
 assert.ok(projection.delta.unchanged.includes('B'));
});

test('memory manager rejects stale summaries and selects fresh tiers within budget',async()=>{
 const manager=new TieredMemoryManager({tokenRegistry:createDefaultTokenAccountingRegistry(),model:'gpt-5.6'});
 manager.add({id:'active',tier:'L0',text:'current blocker',sourceIds:['E1'],sourceHashes:['1'.repeat(64)],validUntil:'2099-01-01T00:00:00.000Z'});
 manager.add({id:'stale',tier:'L2',text:'old decision',sourceIds:['E2'],sourceHashes:['2'.repeat(64)],validUntil:'2000-01-01T00:00:00.000Z'});
 manager.add({id:'project',tier:'L2',text:'stable convention '.repeat(20),sourceIds:['E3'],sourceHashes:['3'.repeat(64)],validUntil:'2099-01-01T00:00:00.000Z'});
 const selected=await manager.select({budgetTokens:80,sourceState:{E1:'1'.repeat(64),E2:'2'.repeat(64),E3:'3'.repeat(64)}});
 assert.ok(selected.entries.some(x=>x.id==='active'));
 assert.ok(!selected.entries.some(x=>x.id==='stale'));
 assert.ok(selected.omissions.some(x=>x.sourceId==='stale'&&/stale|expired/.test(x.reason)));
});

test('tool output distillation stores raw evidence and retains actionable failure ranges',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-v05-blobs-'));const store=new BlobStore(root);
 const raw=['PASS one','PASS two',...Array.from({length:500},(_,i)=>`noise ${i}`),'FAIL tests/auth.test.mjs:42 expected 200 got 500','Error: token expired','    at login (src/auth.mjs:18:3)'].join('\n');
 const distilled=await distillToolOutput({command:'npm test',exitCode:1,durationMs:1234,stdout:raw,stderr:'',blobStore:store,tokenRegistry:createDefaultTokenAccountingRegistry(),model:'gpt-5.6'});
 assert.equal(distilled.status,'failed');
 assert.ok(distilled.summary.includes('FAIL'));
 assert.ok(distilled.relevantRanges.some(x=>x.text.includes('tests/auth.test.mjs:42')));
 assert.ok(distilled.accounting.distilledTokens<distilled.accounting.rawTokens/5);
 assert.equal(await store.verify(distilled.raw.sha256),true);
 assert.match(distilled.receiptSha256,/^[a-f0-9]{64}$/);
});

test('semantic ABI keeps stable symbol ids and refuses stale symbol fetches',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-v05-abi-'));await mkdir(path.join(root,'src'));
 const file=path.join(root,'src','auth.mjs');
 await writeFile(file,'export function login(user){ return user.id }\nexport class AuthError extends Error {}\n');
 const first=await buildSemanticAbi({root,languages:['javascript']});
 const login=first.symbols.find(x=>x.name==='login');assert.ok(login);
 const fetched=await fetchSemanticSymbol({abi:first,symbolId:login.symbolId,expectedHash:login.contentHash});
 assert.match(fetched.body,/function login/);
 await writeFile(file,'export function login(user){ return user.email }\nexport class AuthError extends Error {}\n');
 const second=await buildSemanticAbi({root,languages:['javascript'],previous:first});
 const login2=second.symbols.find(x=>x.name==='login');
 assert.equal(login2.symbolId,login.symbolId);
 assert.notEqual(login2.contentHash,login.contentHash);
 assert.throws(()=>fetchSemanticSymbol({abi:second,symbolId:login.symbolId,expectedHash:login.contentHash}),/stale/i);
});
