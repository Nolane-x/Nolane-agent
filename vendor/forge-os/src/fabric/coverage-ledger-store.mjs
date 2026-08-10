import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../core/canonical-json.mjs';

const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const SHA=/^[a-f0-9]{64}$/;
const id=(value,label)=>{const text=String(value??'');if(!ID.test(text))throw new TypeError(`Invalid ${label}`);return text;};
const now=()=>Date.now();

export class SqliteCoverageLedgerStore{
  constructor(file,{busyTimeoutMs=5_000}={}){
    this.file=path.resolve(file);mkdirSync(path.dirname(this.file),{recursive:true});this.db=new DatabaseSync(this.file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=${Math.max(1,Math.floor(busyTimeoutMs))};
      CREATE TABLE IF NOT EXISTS forge_coverage_ledgers(
        ledger_id TEXT PRIMARY KEY, graph_sha256 TEXT NOT NULL CHECK(length(graph_sha256)=64), created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS forge_coverage_units(
        ledger_id TEXT NOT NULL REFERENCES forge_coverage_ledgers(ledger_id) ON DELETE CASCADE,
        unit_id TEXT NOT NULL, files_json TEXT NOT NULL, status TEXT NOT NULL,
        worker_id TEXT, lease_token TEXT, fencing_sequence INTEGER NOT NULL DEFAULT 0,
        lease_expires_at INTEGER, receipt_sha256 TEXT, updated_at TEXT NOT NULL,
        PRIMARY KEY(ledger_id,unit_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS forge_coverage_status_idx ON forge_coverage_units(ledger_id,status,lease_expires_at);`);
    this.db.exec('PRAGMA foreign_keys=ON;');
  }
  close(){this.db.close();}
  async create({ledgerId,graphSha256,workUnits=[]}){
    ledgerId=id(ledgerId,'coverage ledger id');if(!SHA.test(String(graphSha256)))throw new TypeError('Valid graph SHA-256 is required');
    const units=[...workUnits].map(item=>({unitId:id(item.unitId,'work unit id'),files:[...(item.files??[])].map(String).sort()})).sort((a,b)=>a.unitId.localeCompare(b.unitId));
    if(!units.length)throw new TypeError('At least one work unit is required');if(new Set(units.map(x=>x.unitId)).size!==units.length)throw new Error('Duplicate work unit id');
    const timestamp=new Date().toISOString();this.db.exec('BEGIN IMMEDIATE');
    try{this.db.prepare('INSERT INTO forge_coverage_ledgers(ledger_id,graph_sha256,created_at) VALUES(?,?,?)').run(ledgerId,graphSha256,timestamp);const stmt=this.db.prepare('INSERT INTO forge_coverage_units(ledger_id,unit_id,files_json,status,updated_at) VALUES(?,?,?,?,?)');for(const unit of units)stmt.run(ledgerId,unit.unitId,JSON.stringify(unit.files),'pending',timestamp);this.db.exec('COMMIT');return this.snapshot(ledgerId);}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}
  }
  async acquire(ledgerId,unitId,{workerId,ttlMs=30_000}={}){
    ledgerId=id(ledgerId,'coverage ledger id');unitId=id(unitId,'work unit id');workerId=id(workerId,'worker id');if(!Number.isInteger(ttlMs)||ttlMs<1)throw new TypeError('ttlMs must be positive');
    this.db.exec('BEGIN IMMEDIATE');try{const row=this.db.prepare('SELECT * FROM forge_coverage_units WHERE ledger_id=? AND unit_id=?').get(ledgerId,unitId);if(!row)throw new Error(`Unknown work unit ${unitId}`);const current=now();if(row.status==='completed')throw new Error(`Work unit ${unitId} is completed`);if(row.status==='running'&&row.lease_expires_at>current)throw new Error(`Work unit ${unitId} already has an active lease`);const leaseToken=randomUUID();const fencingSequence=row.fencing_sequence+1;const expiresAt=current+ttlMs;this.db.prepare(`UPDATE forge_coverage_units SET status='running',worker_id=?,lease_token=?,fencing_sequence=?,lease_expires_at=?,receipt_sha256=NULL,updated_at=? WHERE ledger_id=? AND unit_id=?`).run(workerId,leaseToken,fencingSequence,expiresAt,new Date().toISOString(),ledgerId,unitId);this.db.exec('COMMIT');return Object.freeze({ledgerId,unitId,workerId,leaseToken,fencingSequence,expiresAt});}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}
  }
  async heartbeat(ledgerId,unitId,{workerId,leaseToken,fencingSequence,ttlMs=30_000}={}){
    const row=this.#assertLease(ledgerId,unitId,{workerId,leaseToken,fencingSequence,allowExpired:false});const expiresAt=now()+ttlMs;this.db.prepare('UPDATE forge_coverage_units SET lease_expires_at=?,updated_at=? WHERE ledger_id=? AND unit_id=? AND fencing_sequence=?').run(expiresAt,new Date().toISOString(),row.ledger_id,row.unit_id,row.fencing_sequence);return Object.freeze({expiresAt,fencingSequence:row.fencing_sequence});
  }
  async complete(ledgerId,unitId,{workerId,leaseToken,fencingSequence,receiptSha256}={}){
    if(!SHA.test(String(receiptSha256)))throw new TypeError('Valid receipt SHA-256 is required');this.db.exec('BEGIN IMMEDIATE');try{const row=this.#assertLease(ledgerId,unitId,{workerId,leaseToken,fencingSequence,allowExpired:false});this.db.prepare(`UPDATE forge_coverage_units SET status='completed',receipt_sha256=?,lease_expires_at=NULL,updated_at=? WHERE ledger_id=? AND unit_id=? AND fencing_sequence=?`).run(receiptSha256,new Date().toISOString(),row.ledger_id,row.unit_id,row.fencing_sequence);this.db.exec('COMMIT');return Object.freeze({unitId:row.unit_id,status:'completed',receiptSha256,fencingSequence:row.fencing_sequence});}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}
  }
  #assertLease(ledgerId,unitId,{workerId,leaseToken,fencingSequence,allowExpired}){
    ledgerId=id(ledgerId,'coverage ledger id');unitId=id(unitId,'work unit id');workerId=id(workerId,'worker id');const row=this.db.prepare('SELECT * FROM forge_coverage_units WHERE ledger_id=? AND unit_id=?').get(ledgerId,unitId);if(!row)throw new Error(`Unknown work unit ${unitId}`);if(row.status!=='running')throw new Error(`Work unit ${unitId} is not running`);if(row.worker_id!==workerId)throw new Error('Coverage lease owner mismatch');if(row.lease_token!==leaseToken||row.fencing_sequence!==fencingSequence)throw new Error('Stale coverage lease or fencing sequence');if(!allowExpired&&row.lease_expires_at<=now())throw new Error('Coverage lease expired');return row;
  }
  async snapshot(ledgerId){ledgerId=id(ledgerId,'coverage ledger id');const ledger=this.db.prepare('SELECT * FROM forge_coverage_ledgers WHERE ledger_id=?').get(ledgerId);if(!ledger)throw new Error(`Unknown coverage ledger ${ledgerId}`);const records=this.db.prepare('SELECT * FROM forge_coverage_units WHERE ledger_id=? ORDER BY unit_id').all(ledgerId).map(row=>({unitId:row.unit_id,files:JSON.parse(row.files_json),status:row.status,workerId:row.worker_id,fencingSequence:row.fencing_sequence,leaseExpiresAt:row.lease_expires_at,receiptSha256:row.receipt_sha256}));const coverage={total:records.length,completed:records.filter(x=>x.status==='completed').length,running:records.filter(x=>x.status==='running').length,pending:records.filter(x=>x.status==='pending').length};return Object.freeze({ledgerId,graphSha256:ledger.graph_sha256,records,coverage,coverageSha256:canonicalSha256(records)});}
  async assertComplete(ledgerId){const snapshot=await this.snapshot(ledgerId);if(snapshot.coverage.completed!==snapshot.coverage.total)throw new Error(`Coverage incomplete: ${snapshot.coverage.total-snapshot.coverage.completed} uncovered work units`);return Object.freeze({status:'complete',...snapshot});}
}
