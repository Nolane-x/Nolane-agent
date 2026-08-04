import { createHash } from 'node:crypto';
import { assertTenantId } from './project-repository.mjs';

function sha(body){return createHash('sha256').update(body).digest('hex');}
function bodyBuffer(value){if(Buffer.isBuffer(value)) return value;if(value instanceof Uint8Array) return Buffer.from(value);if(typeof value==='string') return Buffer.from(value);throw new TypeError('body must be Buffer, Uint8Array, or string');}
export class ObjectStore { async put(){throw new Error('ObjectStore.put must be implemented');} async get(){throw new Error('ObjectStore.get must be implemented');} }
export class S3CompatibleObjectStore extends ObjectStore {
  constructor({client,bucket,prefix='forgeos'}){super();if(!client?.putObject||!client?.getObject) throw new TypeError('S3-compatible client is required');this.client=client;this.bucket=String(bucket);this.prefix=String(prefix).replace(/^\/+|\/+$/g,'');}
  key(tenant,digest){return `${this.prefix}/${encodeURIComponent(tenant)}/${digest.slice(0,2)}/${digest}`;}
  async put({tenantId,body,contentType='application/octet-stream'}){
    const tenant=assertTenantId(tenantId);const bytes=bodyBuffer(body);const digest=sha(bytes);const key=this.key(tenant,digest);
    let exists=false;try{await this.client.headObject({Bucket:this.bucket,Key:key});exists=true;}catch(error){if(!['NotFound','NoSuchKey'].includes(error?.name)) throw error;}
    if(!exists) await this.client.putObject({Bucket:this.bucket,Key:key,Body:bytes,ContentType:contentType,Metadata:{sha256:digest,tenant}});
    return {key,sha256:digest,size:bytes.length,contentType,created:!exists};
  }
  async get({tenantId,sha256}){
    const tenant=assertTenantId(tenantId);if(!/^[a-f0-9]{64}$/.test(String(sha256))) throw new TypeError('sha256 is invalid');const key=this.key(tenant,sha256);
    const result=await this.client.getObject({Bucket:this.bucket,Key:key});
    const body=bodyBuffer(result.Body);if(sha(body)!==sha256) throw new Error('Object digest mismatch');
    return {key,sha256,body,size:body.length,contentType:result.ContentType??'application/octet-stream',metadata:result.Metadata??{}};
  }
}
