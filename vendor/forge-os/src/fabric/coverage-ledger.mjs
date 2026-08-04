import { canonicalSha256 } from '../core/canonical-json.mjs';
export class CoverageLedger{
 constructor(bundle){this.bundle=bundle;this.records=new Map(bundle.units.map((unit)=>[unit.unitId,{unitId:unit.unitId,status:'pending',workerId:null,receiptSha256:null}]));}
 start(unitId,workerId){const record=this.records.get(unitId);if(!record)throw new Error(`Unknown work unit ${unitId}`);if(record.status!=='pending')throw new Error(`Work unit ${unitId} is ${record.status}`);Object.assign(record,{status:'running',workerId:String(workerId)});return{...record};}
 complete(unitId,{receiptSha256}){const record=this.records.get(unitId);if(!record)throw new Error(`Unknown work unit ${unitId}`);if(record.status!=='running')throw new Error(`Work unit ${unitId} is not running`);if(!/^[a-f0-9]{64}$/.test(String(receiptSha256)))throw new TypeError('Valid receipt SHA-256 is required');Object.assign(record,{status:'completed',receiptSha256});return{...record};}
 snapshot(){const records=[...this.records.values()].map((item)=>({...item})).sort((a,b)=>a.unitId.localeCompare(b.unitId));return{records,coverageSha256:canonicalSha256(records)};}
 assertComplete(){const snapshot=this.snapshot();const uncovered=snapshot.records.filter((item)=>item.status!=='completed');if(uncovered.length)throw new Error(`Coverage incomplete: ${uncovered.length} uncovered work units`);return Object.freeze({status:'complete',...snapshot});}
}
