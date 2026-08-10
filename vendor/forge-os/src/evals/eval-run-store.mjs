import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { atomicWriteJson } from '../storage/durable-json.mjs';

const ID=/^eval_[a-f0-9]{64}$/;
function coreOf(value){const core=structuredClone(value);delete core.id;delete core.sha256;return core;}
export class EvalRunStore{
  #durability=null;
  constructor(directory){this.directory=path.resolve(directory);}
  durability(){return this.#durability?structuredClone(this.#durability.durability):null;}
  file(id){if(!ID.test(String(id??'')))throw new TypeError('Invalid EvalRun id');return path.join(this.directory,`${id}.json`);}
  async put(record){
    if(!record||typeof record!=='object'||Array.isArray(record))throw new TypeError('EvalRun must be an object');
    const core=coreOf(record);const sha256=canonicalSha256(core);const value={...core,id:`eval_${sha256}`,sha256};const file=this.file(value.id);
    try{const existing=await this.read(value.id);if(existing.sha256!==sha256)throw new Error('EvalRun collision');return existing;}catch(cause){if(cause.code!=='ENOENT')throw cause;}
    this.#durability=await atomicWriteJson(file,value);return structuredClone(value);
  }
  async read(id){const value=JSON.parse(await readFile(this.file(id),'utf8'));const expected=canonicalSha256(coreOf(value));if(value.id!==`eval_${expected}`||value.sha256!==expected)throw new Error(`EvalRun integrity hash mismatch: ${id}`);return structuredClone(value);}
  async list(){await mkdir(this.directory,{recursive:true});const files=(await readdir(this.directory)).filter((name)=>name.startsWith('eval_')&&name.endsWith('.json')).sort();const values=[];for(const file of files)values.push(await this.read(file.slice(0,-5)));return values;}
}
