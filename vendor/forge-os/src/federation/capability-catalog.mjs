import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCapability } from './contracts.mjs';
import { capabilitySignature } from './deduplicator.mjs';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../capabilities/catalog.json');
let cache=null;
const tokenize=(value)=>new Set(String(value??'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter((v)=>v.length>1));

export async function loadCapabilityCatalog({refresh=false}={}) {
  const info=await stat(FILE);
  if(cache&&!refresh&&cache.mtimeMs===info.mtimeMs) return cache.records.map((r)=>({...r}));
  const records=JSON.parse(await readFile(FILE,'utf8')).map(normalizeCapability);
  const report=validateCapabilityCatalog(records);
  if(report.errors.length) throw new TypeError(`Invalid capability catalog: ${report.errors.join('; ')}`);
  cache={mtimeMs:info.mtimeMs,records}; return records.map((r)=>({...r}));
}

export function validateCapabilityCatalog(records) {
  const errors=[]; const ids=new Set(); const signatures=new Set(); const domains=new Map(); const produced=new Set(['confirmed-intent']);
  const ordered=[...(records??[])].sort((a,b)=>a.domain.localeCompare(b.domain)||a.ordinal-b.ordinal);
  for(const record of ordered){
    if(ids.has(record.capabilityId)) errors.push(`duplicate capability id: ${record.capabilityId}`); ids.add(record.capabilityId);
    const signature=capabilitySignature(record); if(signatures.has(signature)) errors.push(`duplicate semantic signature: ${record.capabilityId}`); signatures.add(signature);
    if(!domains.has(record.domain))domains.set(record.domain,[]); domains.get(record.domain).push(record);
    for(const input of record.consumes) if(!produced.has(input)) errors.push(`unresolved capability input: ${record.capabilityId} <- ${input}`);
    for(const output of record.produces) produced.add(output);
  }
  for(const [domain,items] of domains){
    items.sort((a,b)=>a.ordinal-b.ordinal);
    if(items.length!==32) errors.push(`${domain}: expected 32 capabilities, got ${items.length}`);
    if(items[0]?.consumes[0]!=='confirmed-intent') errors.push(`${domain}: path must start at confirmed-intent`);
    for(let i=1;i<items.length;i++)if(items[i].consumes[0]!==items[i-1].produces[0])errors.push(`${domain}: broken path at ${items[i].capabilityId}`);
  }
  return {errors,count:records?.length??0,domainCount:domains.size,uniqueSignatures:signatures.size};
}

export function capabilityPath(records, domain){return records.filter((r)=>r.domain===domain).sort((a,b)=>a.ordinal-b.ordinal);}

export function searchCapabilities(records, query, {domain=null,tools=[],limit=20}={}){
  const terms=tokenize(query); const toolSet=new Set(tools);
  return records.map((record)=>{
    let score=0; if(domain&&record.domain===domain)score+=20; else if(domain)score-=10;
    const fields=[record.title,...record.intentSignals,...record.knowledgeTopics,record.discipline];
    for(const field of fields){const tokens=tokenize(field); for(const term of terms)if(tokens.has(term))score+=field===record.title?5:2;}
    for(const tool of record.requiredTools)if(toolSet.has(tool))score+=4;
    return {...record,score};
  }).filter((r)=>r.score>0).sort((a,b)=>b.score-a.score||a.capabilityId.localeCompare(b.capabilityId)).slice(0,limit);
}
