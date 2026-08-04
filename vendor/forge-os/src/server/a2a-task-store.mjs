import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { acquireFileLease } from '../storage/file-lease.mjs';
import { atomicWriteJson } from '../storage/durable-json.mjs';

const TASK_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const terminal=new Set(['TASK_STATE_COMPLETED','TASK_STATE_FAILED','TASK_STATE_CANCELED','TASK_STATE_REJECTED']);
const now=()=>new Date().toISOString();
function validateTaskId(id){const value=String(id??'');if(!TASK_ID.test(value))throw new TypeError('Invalid A2A task id');return value;}
function validUpdate(current,next){if(!next||next.id!==current.id||next.ownerPrincipalId!==current.ownerPrincipalId)throw new Error('Invalid A2A task update');}

export class A2aTaskStore{
  #dir;#queues=new Map();#leaseOptions;#durability=null;
  constructor(directory,{leaseOptions={}}={}){this.#dir=path.resolve(directory);this.#leaseOptions=leaseOptions;}
  #file(id){return path.join(this.#dir,`${validateTaskId(id)}.json`);}
  #lock(id){return path.join(this.#dir,'.locks',`${validateTaskId(id)}.lock`);}
  durability(){return this.#durability?structuredClone(this.#durability.durability):null;}
  async #serialized(id,operation){const previous=this.#queues.get(id)??Promise.resolve();let release;const tail=new Promise((resolve)=>{release=resolve;});const chain=previous.then(()=>tail);this.#queues.set(id,chain);await previous;try{return await operation();}finally{release();if(this.#queues.get(id)===chain)this.#queues.delete(id);}}
  async create(record){const id=validateTaskId(record.id);return this.#serialized(id,async()=>{const lease=await acquireFileLease(this.#lock(id),this.#leaseOptions);try{try{await readFile(this.#file(id),'utf8');throw new Error(`Duplicate A2A task: ${id}`);}catch(cause){if(cause.code!=='ENOENT')throw cause;}await lease.assertOwned();this.#durability=await atomicWriteJson(this.#file(id),{...structuredClone(record),revision:0});return this.read(id);}finally{await lease.release();}});}
  async read(id){return JSON.parse(await readFile(this.#file(id),'utf8'));}
  async update(id,updater,{expectedRevision=null}={}){id=validateTaskId(id);return this.#serialized(id,async()=>{const lease=await acquireFileLease(this.#lock(id),this.#leaseOptions);try{const current=await this.read(id);if(expectedRevision!==null&&current.revision!==expectedRevision)throw new Error(`A2A task revision conflict: expected ${expectedRevision}, received ${current.revision}`);const next=await updater(structuredClone(current));validUpdate(current,next);const stored={...next,revision:current.revision+1};await lease.assertOwned();this.#durability=await atomicWriteJson(this.#file(id),stored);return structuredClone(stored);}finally{await lease.release();}});}
  async list(){await mkdir(this.#dir,{recursive:true});const files=(await readdir(this.#dir)).filter((name)=>name.endsWith('.json')).sort();const tasks=[];for(const file of files){try{tasks.push(JSON.parse(await readFile(path.join(this.#dir,file),'utf8')));}catch{/* quarantine by omission; diagnostics belong to recovery API */}}return tasks;}
}

export class MemoryA2aTaskStore{
  #tasks=new Map();#queues=new Map();
  async #serialized(id,operation){const previous=this.#queues.get(id)??Promise.resolve();let release;const tail=new Promise((resolve)=>{release=resolve;});const chain=previous.then(()=>tail);this.#queues.set(id,chain);await previous;try{return await operation();}finally{release();if(this.#queues.get(id)===chain)this.#queues.delete(id);}}
  async create(record){return this.#serialized(record.id,async()=>{if(this.#tasks.has(record.id))throw new Error(`Duplicate A2A task: ${record.id}`);const value={...structuredClone(record),revision:0};this.#tasks.set(record.id,value);return structuredClone(value);});}
  async read(id){const value=this.#tasks.get(id);if(!value){const error=new Error('A2A task not found');error.code='ENOENT';throw error;}return structuredClone(value);}
  async update(id,updater,{expectedRevision=null}={}){return this.#serialized(id,async()=>{const current=await this.read(id);if(expectedRevision!==null&&current.revision!==expectedRevision)throw new Error(`A2A task revision conflict: expected ${expectedRevision}, received ${current.revision}`);const next=await updater(current);validUpdate(current,next);const value={...next,revision:current.revision+1};this.#tasks.set(id,value);return structuredClone(value);});}
  async list(){return [...this.#tasks.values()].map((value)=>structuredClone(value));}
}

function assertLease(task,token){if(terminal.has(task.status.state))throw new Error('Task is terminal');if(task.metadata?.lease?.token!==token)throw new Error('Task lease is not owned by this worker');if(Date.parse(task.metadata.lease.expiresAt)<=Date.now())throw new Error('Task lease expired');}
export class A2aTaskScheduler{
  constructor(store,{maxAttempts=3,leaseMs=30_000}={}){this.store=store;this.maxAttempts=maxAttempts;this.leaseMs=leaseMs;}
  async leaseNext({workerId}){const candidates=(await this.store.list()).filter((task)=>{if(!task.metadata?.deferred)return false;if(task.status.state==='TASK_STATE_SUBMITTED')return true;return task.status.state==='TASK_STATE_WORKING'&&task.metadata?.lease&&Date.parse(task.metadata.lease.expiresAt)<=Date.now();}).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));for(const candidate of candidates){try{const token=randomUUID();const task=await this.store.update(candidate.id,(current)=>{const submitted=current.status.state==='TASK_STATE_SUBMITTED';const expired=current.status.state==='TASK_STATE_WORKING'&&current.metadata?.lease&&Date.parse(current.metadata.lease.expiresAt)<=Date.now();if(!submitted&&!expired)throw new Error('Task was already leased');const attempt=Number(current.metadata?.attempt??0)+1;if(attempt>this.maxAttempts)throw new Error('Task exceeded retry budget');const stamp=now();return {...current,status:{state:'TASK_STATE_WORKING',timestamp:stamp},statusHistory:[...current.statusHistory,{state:'TASK_STATE_WORKING',timestamp:stamp}],lastModified:stamp,metadata:{...current.metadata,attempt,lease:{token,workerId,leasedAt:stamp,heartbeatAt:stamp,expiresAt:new Date(Date.now()+this.leaseMs).toISOString()},recoveredFromExpiredLease:expired||undefined}};},{expectedRevision:candidate.revision});return {token,task};}catch{/* another scheduler won */}}return null;}
  async heartbeat(id,token){return this.store.update(id,(task)=>{assertLease(task,token);const stamp=now();return {...task,lastModified:stamp,metadata:{...task.metadata,lease:{...task.metadata.lease,heartbeatAt:stamp,expiresAt:new Date(Date.now()+this.leaseMs).toISOString()}}};});}
  async complete(id,token,{result}={}){return this.store.update(id,(task)=>{assertLease(task,token);const stamp=now();return {...task,status:{state:'TASK_STATE_COMPLETED',timestamp:stamp},statusHistory:[...task.statusHistory,{state:'TASK_STATE_COMPLETED',timestamp:stamp}],artifacts:[...task.artifacts,{artifactId:`artifact_${randomUUID().replaceAll('-','')}`,name:'Deferred task result',description:'Result emitted by the leased A2A worker.',parts:[{data:structuredClone(result??{}),mediaType:'application/json'}],extensions:[]}],lastModified:stamp,metadata:{...task.metadata,lease:null,completedBy:task.metadata.lease.workerId}};});}
  async fail(id,token,{reason='Worker failed',retryable=false}={}){return this.store.update(id,(task)=>{assertLease(task,token);const stamp=now();const canRetry=retryable&&Number(task.metadata?.attempt??0)<this.maxAttempts;const state=canRetry?'TASK_STATE_SUBMITTED':'TASK_STATE_FAILED';return {...task,status:{state,timestamp:stamp},statusHistory:[...task.statusHistory,{state,timestamp:stamp}],lastModified:stamp,metadata:{...task.metadata,lease:null,lastFailure:String(reason),retryable:canRetry}};});}
}
