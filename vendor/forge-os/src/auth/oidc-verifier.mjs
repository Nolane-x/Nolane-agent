import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { createPrincipal } from '../core/principals.mjs';

function decodePart(value,label){try{return JSON.parse(Buffer.from(value,'base64url').toString('utf8'));}catch{throw new Error(`Invalid JWT ${label}`);}}
function audiences(value){return Array.isArray(value)?value:[value];}
export class OidcVerifier {
  constructor({issuer,audience,jwks,clock=()=>Math.floor(Date.now()/1000),clockToleranceSeconds=30,maxTokenAgeSeconds=3600}){
    this.issuer=new URL(issuer).toString().replace(/\/$/,'');this.audience=String(audience);if(typeof jwks!=='function') throw new TypeError('jwks loader is required');this.jwks=jwks;this.clock=clock;this.tolerance=clockToleranceSeconds;this.maxAge=maxTokenAgeSeconds;
  }
  async verify(jwt){
    const [encodedHeader,encodedPayload,encodedSignature,...extra]=String(jwt??'').split('.');if(!encodedHeader||!encodedPayload||!encodedSignature||extra.length) throw new Error('Invalid JWT structure');
    const header=decodePart(encodedHeader,'header');const payload=decodePart(encodedPayload,'payload');
    if(header.alg!=='RS256') throw new Error('Unsupported OIDC signature algorithm');
    const set=await this.jwks();const jwk=set?.keys?.find((item)=>item.kid===header.kid&&(!item.alg||item.alg==='RS256'));if(!jwk) throw new Error('OIDC signing key not found');
    const valid=cryptoVerify('RSA-SHA256',Buffer.from(`${encodedHeader}.${encodedPayload}`),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(encodedSignature,'base64url'));if(!valid) throw new Error('Invalid OIDC signature');
    const now=this.clock();
    if(String(payload.iss??'').replace(/\/$/,'')!==this.issuer) throw new Error('Invalid OIDC issuer');
    if(!audiences(payload.aud).includes(this.audience)) throw new Error('Invalid OIDC audience');
    if(!Number.isFinite(payload.exp)||payload.exp<now-this.tolerance) throw new Error('OIDC token expired');
    if(Number.isFinite(payload.nbf)&&payload.nbf>now+this.tolerance) throw new Error('OIDC token is not active');
    if(Number.isFinite(payload.iat)&&now-payload.iat>this.maxAge+this.tolerance) throw new Error('OIDC token is too old');
    const subject=String(payload.sub??'').trim();const tenant=String(payload.tenant_id??payload.tid??'').trim();if(!subject||!tenant) throw new Error('OIDC subject and tenant are required');
    const roles=Array.isArray(payload.roles)?payload.roles.map(String):[];
    const scopes=String(payload.scope??'').split(/\s+/).filter(Boolean);scopes.push(`tenant:${tenant}`);
    return createPrincipal({id:`${this.issuer}|${tenant}|${subject}`,type:'human',roles,scopes,trustDomain:`${this.issuer}/${tenant}`,metadata:{issuer:this.issuer,tenant,subject}});
  }
}
