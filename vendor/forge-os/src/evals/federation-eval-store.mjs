import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { acquireFileLease } from '../storage/file-lease.mjs';
import { assertPrincipal, principalRecord } from '../core/principals.mjs';

async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.${randomUUID()}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});await rename(temp,file);}
export class FederationEvaluationStore {
  constructor(root){this.root=path.resolve(root);this.file=path.join(this.root,'federation-evaluations.json');this.lock=path.join(this.root,'.eval.lock');}
  async initialize(){await mkdir(this.root,{recursive:true});try{await readFile(this.file);}catch(error){if(error.code!=='ENOENT')throw error;await atomic(this.file,{schemaVersion:1,revision:0,receipts:[]});}return this.read();}
  async read(){return JSON.parse(await readFile(this.file,'utf8'));}
  async record(receipt,{principal}){assertPrincipal(principal,{type:'service',role:'federation-evaluator',scope:'evaluate'});const copy=structuredClone(receipt);const claimed=copy.receiptSha256;delete copy.receiptSha256;const computed=canonicalSha256(copy);if(claimed!==computed)throw new Error('Evaluation receipt digest mismatch');const lease=await acquireFileLease(this.lock);try{const state=await this.read();if(state.receipts.some(r=>r.receiptSha256===claimed))return state.receipts.find(r=>r.receiptSha256===claimed);const stored={...receipt,recordedBy:principalRecord(principal),recordedAt:new Date().toISOString()};state.receipts.push(stored);state.revision+=1;await lease.assertOwned();await atomic(this.file,state);return structuredClone(stored);}finally{await lease.release();}}
  async get(receiptId){const state=await this.read();const receipt=state.receipts.find(r=>r.receiptSha256===receiptId||r.id===receiptId);if(!receipt)throw new Error(`Unknown federation evaluation receipt: ${receiptId}`);const copy=structuredClone(receipt);delete copy.recordedBy;delete copy.recordedAt;const claimed=copy.receiptSha256;delete copy.receiptSha256;if(canonicalSha256(copy)!==claimed)throw new Error('Stored evaluation receipt integrity failure');return structuredClone(receipt);}
}
