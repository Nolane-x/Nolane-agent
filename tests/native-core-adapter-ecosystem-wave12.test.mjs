import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm, writeFile, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  FileMemoryAdapterWave12,
  MemoryProviderTckWave12,
  SignedPluginHostWave12,
  DurableAdapterSchedulerWave12,
  KanbanSyncEngineWave12,
  ObservabilityAdapterWave12,
  OperationsUtilityCompatWave12,
} from '../src/native-core/adapter-ecosystem-wave12.mjs';

async function temp(t){const root=await mkdtemp(path.join(os.tmpdir(),'nolane-wave12-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('file memory adapter is durable, versioned, conflict-safe and passes TCK',async(t)=>{const root=await temp(t);const file=path.join(root,'memory.json');const adapter=new FileMemoryAdapterWave12({file,retentionLimit:3});await adapter.open();const first=await adapter.put({id:'m1',text:'alpha',provenance:{sessionId:'s1'}});assert.equal(first.version,1);await assert.rejects(()=>adapter.put({id:'m1',text:'bad',expectedVersion:0}),(e)=>e.code==='VERSION_CONFLICT');await adapter.put({id:'m1',text:'beta',expectedVersion:1});await adapter.put({id:'m2',text:'gamma'});assert.equal(adapter.query('beta')[0].id,'m1');const reopened=new FileMemoryAdapterWave12({file,retentionLimit:3});await reopened.open();assert.equal(reopened.get('m1').text,'beta');await reopened.delete({id:'m1',expectedVersion:2});assert.equal(reopened.get('m1'),null);const report=await new MemoryProviderTckWave12().verify(new FileMemoryAdapterWave12({file:path.join(root,'tck.json')}));assert.equal(report.status,'pass');});

test('signed plugin host verifies package, permissions, transparency log, hot-disable and rollback',()=>{const {privateKey,publicKey}=generateKeyPairSync('ed25519');const host=new SignedPluginHostWave12({allowedCapabilities:['tool:read','command:contribute'],compatibleApiVersion:1});const pkg=(version,content)=>{const manifest={id:'demo',version,apiVersion:1,capabilities:['tool:read'],contributions:{tools:['demo.read']}};const payload=host.signingPayload({manifest,content});return{manifest,content,signature:sign(null,Buffer.from(payload),privateKey).toString('base64'),publicKey:publicKey.export({type:'spki',format:'pem'})};};host.install(pkg('1.0.0','one'));host.activate('demo');assert.equal(host.snapshot().plugins[0].state,'active');assert.throws(()=>host.install({...pkg('2.0.0','two'),signature:'bad'}),(e)=>e.code==='PLUGIN_SIGNATURE_INVALID');host.install(pkg('2.0.0','two'));host.disable('demo');assert.equal(host.rollback('demo').version,'1.0.0');assert.equal(host.snapshot().transparencyHead.length,64);});

test('durable scheduler handles clock skew and duplicate delivery idempotently',async(t)=>{const root=await temp(t);let now=1000;const deliveries=[];const scheduler=new DurableAdapterSchedulerWave12({file:path.join(root,'jobs.json'),clock:()=>now,handler:async(job)=>deliveries.push(job.id)});await scheduler.open();await scheduler.schedule({id:'j1',runAt:1010,payload:{x:1}});assert.equal((await scheduler.runDue()).length,0);now=1015;assert.equal((await scheduler.runDue()).length,1);assert.equal((await scheduler.runDue()).length,0);now=900;assert.equal((await scheduler.runDue()).length,0);assert.deepEqual(deliveries,['j1']);});

test('kanban sync prevents duplicate cards and reports optimistic conflicts',()=>{const board=new KanbanSyncEngineWave12();board.apply({id:'c1',title:'A',column:'todo',version:1});assert.equal(board.apply({id:'c1',title:'A',column:'todo',version:1}).duplicate,true);assert.throws(()=>board.apply({id:'c1',title:'B',column:'doing',version:1}),(e)=>e.code==='KANBAN_CONFLICT');assert.equal(board.apply({id:'c1',title:'B',column:'doing',version:2}).card.column,'doing');assert.equal(board.snapshot().cards,1);});

test('observability adapter redacts secrets, enforces backpressure and recovers after disconnect',async()=>{const batches=[];let connected=false;const adapter=new ObservabilityAdapterWave12({maxQueue:2,exporter:{connected:()=>connected,export:async(batch)=>batches.push(batch)}});adapter.record({type:'span',token:'secret',nested:{password:'hidden'}});adapter.record({type:'metric',value:1});assert.throws(()=>adapter.record({type:'overflow'}),(e)=>e.code==='OBSERVABILITY_BACKPRESSURE');connected=true;const flushed=await adapter.flush();assert.equal(flushed.exported,2);assert.equal(JSON.stringify(batches).includes('secret'),false);assert.equal(JSON.stringify(batches).includes('hidden'),false);});

test('operations utility cleanup is root-bounded and reports removed bytes',async(t)=>{const root=await temp(t);await mkdir(path.join(root,'cache'));await writeFile(path.join(root,'cache','a.bin'),Buffer.alloc(5));const utility=new OperationsUtilityCompatWave12({root});const result=await utility.cleanup({relativePath:'cache'});assert.equal(result.removedBytes,5);await assert.rejects(()=>stat(path.join(root,'cache','a.bin')));await assert.rejects(()=>utility.cleanup({relativePath:'../outside'}),(e)=>e.code==='PATH_OUTSIDE_ROOT');});
