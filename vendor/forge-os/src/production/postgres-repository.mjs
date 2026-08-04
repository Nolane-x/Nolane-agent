import { createHash } from 'node:crypto';
import { ProjectRepository, assertTenantId, assertIdempotencyKey } from './project-repository.mjs';

function canonical(value){
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
function digest(value){return createHash('sha256').update(canonical(value)).digest('hex');}
function projectId(value){const id=String(value??'').trim();if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,159}$/.test(id)) throw new TypeError('projectId is invalid');return id;}

export class PostgresProjectRepository extends ProjectRepository {
  constructor({database}){super();if(!database?.transaction) throw new TypeError('database.transaction is required');this.database=database;}
  async read({tenantId,projectId:inputId}){
    const tenant=assertTenantId(tenantId); const id=projectId(inputId);
    return this.database.transaction(async(tx)=>{
      const result=await tx.query('SELECT payload, revision, fencing_token FROM forge_projects WHERE tenant_id = $1 AND project_id = $2',[tenant,id]);
      return result.rows[0]?.payload ? structuredClone(result.rows[0].payload) : null;
    },{isolationLevel:'serializable',readOnly:true});
  }
  async commit({tenantId,project,expectedRevision,fencingToken,idempotencyKey,events=[]}){
    const tenant=assertTenantId(tenantId); const id=projectId(project?.id); const key=assertIdempotencyKey(idempotencyKey);
    if(!Number.isInteger(expectedRevision)||expectedRevision<0) throw new TypeError('expectedRevision must be a non-negative integer');
    if(!Number.isSafeInteger(fencingToken)||fencingToken<1) throw new TypeError('fencingToken must be a positive safe integer');
    if(project.revision!==expectedRevision+1) throw new TypeError('project.revision must equal expectedRevision + 1');
    const requestDigest=digest({tenant,id,project,expectedRevision,fencingToken,events});
    return this.database.transaction(async(tx)=>{
      const idem=await tx.query('INSERT INTO forge_idempotency (tenant_id, idempotency_key, request_digest) VALUES ($1,$2,$3) ON CONFLICT (tenant_id,idempotency_key) DO UPDATE SET request_digest=forge_idempotency.request_digest RETURNING request_digest, (xmax = 0) AS created',[tenant,key,requestDigest]);
      const record=idem.rows[0];
      if(record && record.created===false){
        if(record.request_digest!==requestDigest) throw new Error('Idempotency key conflict');
        return {revision:project.revision,idempotentReplay:true};
      }
      const saved=await tx.query(`INSERT INTO forge_projects (tenant_id, project_id, revision, fencing_token, payload)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (tenant_id,project_id) DO UPDATE SET revision=EXCLUDED.revision,fencing_token=EXCLUDED.fencing_token,payload=EXCLUDED.payload
        WHERE forge_projects.revision = $3 - 1 AND forge_projects.fencing_token < $4
        RETURNING revision`,[tenant,id,project.revision,fencingToken,JSON.stringify(project)]);
      if(saved.rowCount!==1) throw new Error('Project write conflict or stale fencing token');
      for(const [index,event] of events.entries()) await tx.query('INSERT INTO forge_outbox (tenant_id, project_id, sequence, event_payload) VALUES ($1,$2,$3,$4)',[tenant,id,index,JSON.stringify(event)]);
      return {revision:saved.rows[0]?.revision??project.revision,idempotentReplay:false};
    },{isolationLevel:'serializable'});
  }
  async health(){
    try{return await this.database.transaction(async(tx)=>{await tx.query('SELECT 1 AS ok',[]);return {ok:true};},{isolationLevel:'serializable',readOnly:true});}
    catch(error){return {ok:false,reason:'repository-unavailable',errorCode:error?.code??null};}
  }
}
