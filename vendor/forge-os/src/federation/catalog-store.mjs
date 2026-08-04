import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { acquireFileLease } from '../storage/file-lease.mjs';
import { canonicalSha256 } from '../core/canonical-json.mjs';

async function atomicWrite(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.${randomUUID()}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',mode:0o600});await rename(temp,file);}
export class FederationCatalogStore{
  constructor(root){this.root=path.resolve(root);this.file=path.join(this.root,'federation-catalog.json');this.lock=path.join(this.root,'.catalog.lock');}
  async initialize(){await mkdir(this.root,{recursive:true});try{await readFile(this.file);}catch(error){if(error.code!=='ENOENT')throw error;await atomicWrite(this.file,{schemaVersion:1,revision:0,providers:[],events:[],headSha256:null});}return this.read();}
  async read(){return JSON.parse(await readFile(this.file,'utf8'));}
  async #update(mutator,{expectedRevision=null}={}){const lease=await acquireFileLease(this.lock);try{const current=await this.read();if(expectedRevision!==null&&current.revision!==expectedRevision)throw new Error(`Federation revision conflict: expected ${expectedRevision}, got ${current.revision}`);const next=structuredClone(current);const changed=await mutator(next);if(changed===false)return structuredClone(current);next.revision=current.revision+1;const event={id:`fedevent_${randomUUID().replaceAll('-','')}`,revision:next.revision,at:new Date().toISOString(),prevSha256:current.headSha256,providersSha256:canonicalSha256(next.providers)};event.eventSha256=canonicalSha256(event);next.events.push(event);next.headSha256=event.eventSha256;await lease.assertOwned();await atomicWrite(this.file,next);return structuredClone(next);}finally{await lease.release();}}
  async importProvider(provider,options={}){return this.#update((state)=>{if(state.providers.some((item)=>item.providerId===provider.providerId))throw new Error(`Duplicate provider: ${provider.providerId}`);state.providers.push(structuredClone(provider));},options);}
  async replaceProvider(provider,options={}){return this.#update((state)=>{const index=state.providers.findIndex((item)=>item.providerId===provider.providerId);if(index<0)throw new Error(`Unknown provider: ${provider.providerId}`);state.providers[index]=structuredClone(provider);},options);}
  async seedProviders(providers,options={}){if(!Array.isArray(providers))throw new TypeError('providers must be an array');return this.#update((state)=>{const existing=new Set(state.providers.map((item)=>item.providerId));const additions=providers.filter((item)=>!existing.has(item.providerId));if(!additions.length)return false;state.providers.push(...structuredClone(additions));return true;},options);}
}
