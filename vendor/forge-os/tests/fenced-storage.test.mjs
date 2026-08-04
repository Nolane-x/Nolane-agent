import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireFileLease, LeaseLostError } from '../src/storage/file-lease.mjs';
import { ProjectStore } from '../src/core/project-store.mjs';

const helper=fileURLToPath(new URL('./helpers/project-writer.mjs',import.meta.url));
function child(args){
  const proc=fork(helper,args,{stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';proc.stderr.on('data',(chunk)=>{stderr+=chunk});
  const messages=[];proc.on('message',(value)=>messages.push(value));
  return {proc,messages,done:new Promise((resolve,reject)=>{proc.once('exit',(code)=>code===0?resolve(messages):reject(new Error(`child exit ${code}: ${stderr}`)));})};
}

test('cross-process writers cannot steal a live lease after lease duration',async(t)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forge-fenced-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new ProjectStore(dir,{lockTimeoutMs:2_000,leaseMs:60,heartbeatMs:20});
  const project=await store.create({name:'Fenced'});
  const a=child([dir,project.id,'A','220']);
  await new Promise((resolve)=>{const timer=setInterval(()=>{if(a.messages.includes('entered')){clearInterval(timer);resolve();}},5)});
  const b=child([dir,project.id,'B','0']);
  await Promise.all([a.done,b.done]);
  const final=await store.read(project.id);
  assert.ok(final.history.some((event)=>event.type==='A'));
  assert.ok(final.history.some((event)=>event.type==='B'));
  assert.equal(final.revision,3);
});

test('a former owner cannot release a replacement lease',async(t)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forge-lease-owner-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const lock=path.join(dir,'resource.lock');
  const first=await acquireFileLease(lock,{acquireTimeoutMs:500,leaseMs:500,heartbeatMs:50});
  const ownerPath=path.join(lock,'owner.json');
  const firstOwner=JSON.parse(await readFile(ownerPath,'utf8'));
  await first.stopHeartbeat();
  await writeFile(ownerPath,JSON.stringify({...firstOwner,pid:999999,expiresAt:new Date(Date.now()-10_000).toISOString()}));
  const second=await acquireFileLease(lock,{acquireTimeoutMs:500,leaseMs:500,heartbeatMs:50});
  await first.release();
  await second.assertOwned();
  await assert.rejects(()=>first.assertOwned(),LeaseLostError);
  await second.release();
});

test('project audit hash chain detects state and event tampering',async(t)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forge-audit-chain-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new ProjectStore(dir);
  const project=await store.create({name:'Audit'});
  await store.update(project.id,(state)=>({...state,name:'Audit 2'}));
  const file=path.join(dir,`${project.id}.json`);
  const raw=JSON.parse(await readFile(file,'utf8'));
  assert.equal(raw.audit.sequence,2);
  raw.name='tampered';
  await writeFile(file,JSON.stringify(raw));
  await assert.rejects(()=>store.read(project.id),/audit|state digest|hash chain/i);
});

test('snapshots are verifiable and can be restored with revision protection',async(t)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forge-snapshot-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new ProjectStore(dir,{snapshotLimit:4});
  const project=await store.create({name:'Before'});
  const updated=await store.update(project.id,(state)=>({...state,name:'After'}));
  const snapshots=await store.listSnapshots(project.id);
  assert.equal(snapshots.length,1);
  assert.equal((await store.verifySnapshot(project.id,snapshots[0].revision)).valid,true);
  const restored=await store.restoreSnapshot(project.id,snapshots[0].revision,{expectedRevision:updated.revision});
  assert.equal(restored.name,'Before');
  assert.equal(restored.revision,updated.revision+1);
  assert.ok(restored.history.some((event)=>event.type==='snapshot-restored'));
});
