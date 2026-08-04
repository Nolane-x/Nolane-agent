import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const TASK_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
function taskId(value){const id=String(value??'');if(!TASK_ID.test(id))throw new TypeError('Invalid A2A task id');return id;}
function validUpdate(current,next){if(!next||next.id!==current.id||next.ownerPrincipalId!==current.ownerPrincipalId)throw new Error('Invalid A2A task update');}

export class SqliteA2aTaskStore {
  constructor(file,{busyTimeoutMs=5_000}={}){
    this.file=path.resolve(file);mkdirSync(path.dirname(this.file),{recursive:true});this.db=new DatabaseSync(this.file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=${Math.max(1,Math.floor(busyTimeoutMs))};`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS forge_a2a_tasks (
      task_id TEXT PRIMARY KEY,
      owner_principal_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>=0),
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS forge_a2a_state_idx ON forge_a2a_tasks(state,updated_at);`);
  }
  close(){this.db.close();}
  async health(){try{this.db.prepare('SELECT 1').get();return{ok:true,backend:'sqlite-wal'};}catch(error){return{ok:false,backend:'sqlite-wal',reason:error.code??'sqlite-error'};}}
  async create(record){const id=taskId(record.id);const value={...structuredClone(record),revision:0};this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO forge_a2a_tasks(task_id,owner_principal_id,revision,state,updated_at,payload) VALUES(?,?,?,?,?,?)').run(id,value.ownerPrincipalId,0,value.status.state,value.lastModified??value.createdAt,JSON.stringify(value));this.db.exec('COMMIT');return structuredClone(value);}catch(error){try{this.db.exec('ROLLBACK');}catch{}if(String(error.code).includes('CONSTRAINT'))throw new Error(`Duplicate A2A task: ${id}`);throw error;}}
  async read(id){id=taskId(id);const row=this.db.prepare('SELECT payload FROM forge_a2a_tasks WHERE task_id=?').get(id);if(!row){const error=new Error('A2A task not found');error.code='ENOENT';throw error;}return JSON.parse(row.payload);}
  async update(id,updater,{expectedRevision=null}={}){id=taskId(id);this.db.exec('BEGIN IMMEDIATE');try{const row=this.db.prepare('SELECT revision,payload FROM forge_a2a_tasks WHERE task_id=?').get(id);if(!row){const error=new Error('A2A task not found');error.code='ENOENT';throw error;}const current=JSON.parse(row.payload);if(expectedRevision!==null&&current.revision!==expectedRevision)throw new Error(`A2A task revision conflict: expected ${expectedRevision}, received ${current.revision}`);const next=updater(structuredClone(current));if(next&&typeof next.then==='function')throw new TypeError('SQLite A2A updater must be synchronous');validUpdate(current,next);const stored={...next,revision:current.revision+1};const result=this.db.prepare('UPDATE forge_a2a_tasks SET revision=?,state=?,updated_at=?,payload=? WHERE task_id=? AND revision=?').run(stored.revision,stored.status.state,stored.lastModified??new Date().toISOString(),JSON.stringify(stored),id,current.revision);if(result.changes!==1)throw new Error(`A2A task revision conflict: expected ${current.revision}`);this.db.exec('COMMIT');return structuredClone(stored);}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}}
  async list(){return this.db.prepare('SELECT payload FROM forge_a2a_tasks ORDER BY updated_at,task_id').all().map((row)=>JSON.parse(row.payload));}
}
