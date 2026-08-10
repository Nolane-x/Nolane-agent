import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { A2aTaskStore, MemoryA2aTaskStore, A2aTaskScheduler } from '../src/server/a2a-task-store.mjs';
import { handleA2aRpc } from '../src/server/a2a.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const baseTask=(id='task_shared')=>({id,contextId:'context-1',ownerPrincipalId:'agent:owner',status:{state:'TASK_STATE_SUBMITTED',timestamp:'2026-07-25T00:00:00.000Z'},statusHistory:[{state:'TASK_STATE_SUBMITTED',timestamp:'2026-07-25T00:00:00.000Z'}],artifacts:[],history:[],createdAt:'2026-07-25T00:00:00.000Z',lastModified:'2026-07-25T00:00:00.000Z',metadata:{deferred:true}});
const wait=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

test('two file-store instances serialize updates without losing either mutation',async(t)=>{
  const root=await mkdtemp(path.join(tmpdir(),'forge-a2a-cross-store-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const first=new A2aTaskStore(root);const second=new A2aTaskStore(root);
  await first.create(baseTask());
  assert.equal(first.durability()?.fileSync,'completed');
  assert.ok(['completed','unsupported'].includes(first.durability()?.directorySync));
  await Promise.all([
    first.update('task_shared',async(current)=>{await wait(40);return {...current,metadata:{...current.metadata,a:true}};}),
    second.update('task_shared',async(current)=>{await wait(5);return {...current,metadata:{...current.metadata,b:true}};}),
  ]);
  const stored=await first.read('task_shared');
  assert.equal(stored.metadata.a,true);assert.equal(stored.metadata.b,true);assert.equal(stored.revision,2);
});

test('memory task store serializes overlapping updates too',async()=>{
  const store=new MemoryA2aTaskStore();await store.create(baseTask());
  await Promise.all([
    store.update('task_shared',async(current)=>{await wait(25);return {...current,metadata:{...current.metadata,a:true}};}),
    store.update('task_shared',async(current)=>{await wait(1);return {...current,metadata:{...current.metadata,b:true}};}),
  ]);
  const stored=await store.read('task_shared');assert.equal(stored.metadata.a,true);assert.equal(stored.metadata.b,true);
});

test('historyLength zero returns no messages instead of the full task history',async()=>{
  const store=new MemoryA2aTaskStore();
  const principal=createPrincipal({id:'agent:owner',type:'agent',roles:['worker'],trustDomain:'team:a'});
  await store.create({...baseTask(),history:[{messageId:'m1',role:'ROLE_USER',parts:[{text:'one'}]},{messageId:'m2',role:'ROLE_AGENT',parts:[{text:'two'}]}]});
  const result=await handleA2aRpc({jsonrpc:'2.0',id:1,method:'GetTask',params:{id:'task_shared',historyLength:0}},{principal,taskStore:store});
  assert.deepEqual(result.result.history,[]);
});

test('deferred tasks have a lease, heartbeat, retry, cancellation, and terminal completion contract',async(t)=>{
  const root=await mkdtemp(path.join(tmpdir(),'forge-a2a-scheduler-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const store=new A2aTaskStore(root);await store.create(baseTask('task_deferred'));
  const scheduler=new A2aTaskScheduler(store,{maxAttempts:2,leaseMs:1000});
  const lease=await scheduler.leaseNext({workerId:'worker-1'});
  assert.equal(lease.task.status.state,'TASK_STATE_WORKING');
  assert.ok(lease.token);
  await scheduler.heartbeat(lease.task.id,lease.token);
  await scheduler.fail(lease.task.id,lease.token,{reason:'temporary dependency failure',retryable:true});
  const retry=await scheduler.leaseNext({workerId:'worker-2'});
  assert.equal(retry.task.metadata.attempt,2);
  const completed=await scheduler.complete(retry.task.id,retry.token,{result:{ok:true}});
  assert.equal(completed.status.state,'TASK_STATE_COMPLETED');
  await assert.rejects(()=>scheduler.complete(retry.task.id,retry.token,{result:{again:true}}),/lease|terminal/i);
});

test('scheduler reclaims an expired working lease without losing retry accounting',async()=>{
  const store=new MemoryA2aTaskStore();await store.create(baseTask('task_expired'));
  const scheduler=new A2aTaskScheduler(store,{maxAttempts:3,leaseMs:20});
  const first=await scheduler.leaseNext({workerId:'worker-stale'});
  assert.equal(first.task.status.state,'TASK_STATE_WORKING');
  await wait(35);
  const second=await scheduler.leaseNext({workerId:'worker-recovery'});
  assert.ok(second);
  assert.equal(second.task.id,'task_expired');
  assert.equal(second.task.metadata.attempt,2);
  await assert.rejects(()=>scheduler.complete(first.task.id,first.token,{result:{stale:true}}),/lease/i);
  const completed=await scheduler.complete(second.task.id,second.token,{result:{recovered:true}});
  assert.equal(completed.status.state,'TASK_STATE_COMPLETED');
});

test('CancelTask clears an active worker lease so a canceled task cannot be completed',async()=>{
  const store=new MemoryA2aTaskStore();await store.create(baseTask('task_cancel_leased'));
  const scheduler=new A2aTaskScheduler(store,{leaseMs:1000});
  const lease=await scheduler.leaseNext({workerId:'worker-1'});
  const principal=createPrincipal({id:'agent:owner',type:'agent',roles:['worker'],trustDomain:'team:a'});
  const canceled=await handleA2aRpc({jsonrpc:'2.0',id:2,method:'CancelTask',params:{id:'task_cancel_leased'}},{principal,taskStore:store});
  assert.equal(canceled.result.status.state,'TASK_STATE_CANCELED');
  assert.equal((await store.read('task_cancel_leased')).metadata.lease,null);
  await assert.rejects(()=>scheduler.complete(lease.task.id,lease.token,{result:{tooLate:true}}),/lease|terminal/i);
});
