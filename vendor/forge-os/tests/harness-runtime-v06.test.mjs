import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {HARNESS_EVENTS,runHarnessEvent} from '../src/harness/event-runtime.mjs';
import {compileHarnessProfile,installHarnessProfile,uninstallHarnessProfile} from '../src/harness/profile-compiler.mjs';
import {compileCapabilityMatrix} from '../src/harness/capability-matrix.mjs';
import {HarnessMemoryStore} from '../src/harness/memory-store.mjs';

const principal={id:'user-1',type:'human',roles:['harness-admin'],trustDomain:'tenant:t1'};

test('harness event contract is stable and hook denial is fail closed before tool execution',async()=>{
 assert.ok(HARNESS_EVENTS.includes('before.tool.execute'));assert.ok(HARNESS_EVENTS.includes('session.compact'));
 let executed=false;
 await assert.rejects(()=>runHarnessEvent({event:'before.tool.execute',payload:{tool:'shell',command:'rm -rf /'},rules:[{id:'deny-destructive',predicate:({payload})=>payload.command.includes('rm -rf'),decision:'deny'}],hooks:[{id:'audit',event:'before.tool.execute',run:async()=>({status:'observed'})}],action:async()=>{executed=true;}}),/denied/i);
 assert.equal(executed,false);
 const allowed=await runHarnessEvent({event:'before.tool.execute',payload:{tool:'test-runner',command:'npm test'},rules:[],hooks:[],action:async()=>({ok:true})});
 assert.equal(allowed.status,'completed');
 assert.match(allowed.eventReceiptSha256,/^[a-f0-9]{64}$/);
});

test('profile compiler installs selectively, preserves user overrides, and uninstall removes only managed files',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'forge-profile-'));try{
  const plan=compileHarnessProfile({profile:'coding',target:'codex',capabilities:{hooks:true,mcp:true,memory:true}});
  assert.ok(plan.components.includes('code-review-intelligence'));
  assert.ok(plan.permissionDiff.some(x=>x.resource==='mcp'));
  await mkdir(path.join(dir,'.forgeos'),{recursive:true});await writeFile(path.join(dir,'.forgeos','user-note.md'),'keep me');
  const installed=await installHarnessProfile({root:dir,plan,principal});
  assert.ok(installed.files.length>2);
  await writeFile(path.join(dir,installed.files[0]),'user override');
  await uninstallHarnessProfile({root:dir,installation:installed,principal});
  assert.equal(await readFile(path.join(dir,'.forgeos','user-note.md'),'utf8'),'keep me');
  assert.equal(await readFile(path.join(dir,installed.files[0]),'utf8'),'user override');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('capability matrix never advertises unsupported host enforcement',()=>{
 const matrix=compileCapabilityMatrix({host:'generic-chat',hostCapabilities:{skills:true,hooks:false,mcp:false,subagents:false}});
 assert.equal(matrix.features.skills.status,'supported');
 assert.equal(matrix.features.hooks.status,'unsupported');
 assert.equal(matrix.features.mcp.status,'unsupported');
 assert.match(matrix.matrixSha256,/^[a-f0-9]{64}$/);
});

test('harness memory is isolated by tenant, project, user, and harness with bounded injection',()=>{
 const store=new HarnessMemoryStore({maxActive:2});
 store.record({tenantId:'t1',projectId:'p1',userId:'u1',harness:'codex',id:'m1',text:'Use pnpm',confidence:0.9,validUntil:'2099-01-01T00:00:00.000Z'});
 store.record({tenantId:'t1',projectId:'p1',userId:'u1',harness:'codex',id:'m2',text:'Run contract tests',confidence:0.8,validUntil:'2099-01-01T00:00:00.000Z'});
 store.record({tenantId:'t1',projectId:'p1',userId:'u1',harness:'codex',id:'m3',text:'Low confidence',confidence:0.1,validUntil:'2099-01-01T00:00:00.000Z'});
 assert.deepEqual(store.select({tenantId:'t1',projectId:'p1',userId:'u1',harness:'codex'}).map(x=>x.id),['m1','m2']);
 assert.equal(store.select({tenantId:'t1',projectId:'p1',userId:'u1',harness:'claude'}).length,0);
 assert.equal(store.select({tenantId:'t2',projectId:'p1',userId:'u1',harness:'codex'}).length,0);
});
