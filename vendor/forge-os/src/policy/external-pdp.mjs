import { createHash } from 'node:crypto';
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;}
export class ExternalPolicyDecisionPoint {
  constructor({endpoint,policyRevision='unknown',fetchImpl=globalThis.fetch,clock=Date.now,ttlMs=5_000,timeoutMs=1_000,maxEntries=1_000}){this.endpoint=new URL(endpoint).toString();this.revision=String(policyRevision);this.fetch=fetchImpl;this.clock=clock;this.ttlMs=ttlMs;this.timeoutMs=timeoutMs;this.maxEntries=maxEntries;this.cache=new Map();}
  key(input){return createHash('sha256').update(`${this.revision}\0${canonical(input)}`).digest('hex');}
  async decide(input){
    const now=this.clock();for(const [key,value] of this.cache) if(value.expiresAt<=now)this.cache.delete(key);
    const key=this.key(input);const hit=this.cache.get(key);if(hit&&hit.expiresAt>now)return structuredClone(hit.value);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await this.fetch(this.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input,policyRevision:this.revision}),signal:controller.signal});
      if(!response.ok) return {allow:false,reason:`policy service unavailable (${response.status})`,policyRevision:this.revision};
      const body=await response.json();const result=body?.result;const value={allow:result?.allow===true,reason:String(result?.reason??(result?.allow?'allowed':'denied')),policyRevision:this.revision,obligations:Array.isArray(result?.obligations)?result.obligations:[]};
      if(this.cache.size>=this.maxEntries)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,{value,expiresAt:now+this.ttlMs});return structuredClone(value);
    }catch(error){return {allow:false,reason:error?.name==='AbortError'?'policy timeout':'policy service unavailable',policyRevision:this.revision};}finally{clearTimeout(timer);}
  }
}
