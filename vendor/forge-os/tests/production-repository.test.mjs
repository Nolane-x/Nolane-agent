import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PostgresProjectRepository } from '../src/production/postgres-repository.mjs';
import { S3CompatibleObjectStore } from '../src/production/object-store.mjs';

class FakeDatabase {
  constructor(){ this.calls=[]; this.rows=new Map(); this.outbox=[]; this.idempotency=new Map(); }
  async transaction(fn,{isolationLevel}={}){
    assert.equal(isolationLevel,'serializable');
    const staged=[];
    const tx={query:async(sql,params=[])=>{
      this.calls.push({sql,params});
      if(/SELECT .*forge_projects/i.test(sql)){
        const [tenant,id]=params; const row=this.rows.get(`${tenant}:${id}`); return {rows:row?[structuredClone(row)]:[]};
      }
      if(/INSERT INTO forge_idempotency/i.test(sql)){
        const [tenant,key,digest]=params; const k=`${tenant}:${key}`;
        if(this.idempotency.has(k)) return {rows:[{request_digest:this.idempotency.get(k),created:false}]};
        staged.push(()=>this.idempotency.set(k,digest)); return {rows:[{request_digest:digest,created:true}]};
      }
      if(/INSERT INTO forge_projects/i.test(sql)){
        const [tenant,id,revision,fencing,payload]=params;
        const k=`${tenant}:${id}`; const current=this.rows.get(k);
        if(current && (current.revision!==revision-1 || current.fencing_token>=fencing)) return {rowCount:0,rows:[]};
        staged.push(()=>this.rows.set(k,{tenant_id:tenant,project_id:id,revision,fencing_token:fencing,payload:JSON.parse(payload)}));
        return {rowCount:1,rows:[{revision}]};
      }
      if(/INSERT INTO forge_outbox/i.test(sql)){
        staged.push(()=>this.outbox.push({tenant:params[0],project:params[1],event:JSON.parse(params[3])})); return {rowCount:1,rows:[]};
      }
      throw new Error(`Unexpected SQL ${sql}`);
    }};
    const result=await fn(tx); staged.forEach((apply)=>apply()); return result;
  }
}

test('Postgres repository enforces tenant predicates, serializable CAS, fencing, idempotency, and same-transaction outbox', async()=>{
  const db=new FakeDatabase();
  const repo=new PostgresProjectRepository({database:db});
  const project={id:'forge_prod',revision:1,stage:'intent'};
  const result=await repo.commit({tenantId:'tenant-a',project,expectedRevision:0,fencingToken:7,idempotencyKey:'request-1',events:[{type:'ProjectCreated'}]});
  assert.equal(result.revision,1);
  assert.equal(db.outbox.length,1);
  assert.ok(db.calls.every(({sql})=>!(/forge_projects/i.test(sql)) || /tenant_id/i.test(sql)));
  const read=await repo.read({tenantId:'tenant-a',projectId:'forge_prod'});
  assert.equal(read.stage,'intent');
  assert.equal(await repo.read({tenantId:'tenant-b',projectId:'forge_prod'}),null);
  await assert.rejects(()=>repo.commit({tenantId:'tenant-a',project:{...project,revision:2},expectedRevision:1,fencingToken:6,idempotencyKey:'request-2',events:[]}),/conflict|fencing/i);
  const duplicate=await repo.commit({tenantId:'tenant-a',project,expectedRevision:0,fencingToken:7,idempotencyKey:'request-1',events:[{type:'ProjectCreated'}]});
  assert.equal(duplicate.idempotentReplay,true);
});

class FakeS3 {
  constructor(){this.objects=new Map();}
  async putObject({Bucket,Key,Body,ContentType,Metadata}){this.objects.set(`${Bucket}/${Key}`,{Body:Buffer.from(Body),ContentType,Metadata});return {ETag:'etag'};}
  async getObject({Bucket,Key}){const value=this.objects.get(`${Bucket}/${Key}`); if(!value){const e=new Error('not found');e.name='NoSuchKey';throw e;} return value;}
  async headObject({Bucket,Key}){const value=this.objects.get(`${Bucket}/${Key}`);if(!value){const e=new Error('not found');e.name='NotFound';throw e;}return {ContentLength:value.Body.length,ContentType:value.ContentType,Metadata:value.Metadata};}
}

test('S3-compatible object store writes content-addressed immutable blobs and verifies digest on read',async()=>{
  const client=new FakeS3(); const store=new S3CompatibleObjectStore({client,bucket:'forge-prod',prefix:'blobs'});
  const body=Buffer.from('trusted evidence payload');
  const expected=createHash('sha256').update(body).digest('hex');
  const first=await store.put({tenantId:'tenant-a',body,contentType:'text/plain'});
  const second=await store.put({tenantId:'tenant-a',body,contentType:'text/plain'});
  assert.equal(first.sha256,expected); assert.equal(first.key,second.key);
  const loaded=await store.get({tenantId:'tenant-a',sha256:expected});
  assert.equal(loaded.body.toString(),'trusted evidence payload');
  const raw=client.objects.get(`forge-prod/${first.key}`); raw.Body=Buffer.from('tampered');
  await assert.rejects(()=>store.get({tenantId:'tenant-a',sha256:expected}),/digest mismatch/i);
});
