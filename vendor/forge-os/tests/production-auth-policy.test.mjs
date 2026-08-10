import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { OidcVerifier } from '../src/auth/oidc-verifier.mjs';
import { ExternalPolicyDecisionPoint } from '../src/policy/external-pdp.mjs';
import { authorizeFederationAction } from '../src/policy/federation-policy.mjs';

function b64(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}
function token(privateKey,header,payload){const input=`${b64(header)}.${b64(payload)}`;const signature=createSign('RSA-SHA256').update(input).end().sign(privateKey).toString('base64url');return `${input}.${signature}`;}

test('OIDC verifier validates signature, issuer, audience, expiry, tenant, and canonical subject',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk=publicKey.export({format:'jwk'}); jwk.kid='kid-1'; jwk.use='sig'; jwk.alg='RS256';
  const now=Math.floor(Date.now()/1000);
  const verifier=new OidcVerifier({issuer:'https://id.example.com',audience:'forgeos',jwks:async()=>({keys:[jwk]}),clock:()=>now});
  const jwt=token(privateKey,{alg:'RS256',kid:'kid-1',typ:'JWT'},{iss:'https://id.example.com',aud:'forgeos',sub:'user-1',exp:now+300,iat:now,tenant_id:'tenant-a',roles:['federation-admin']});
  const principal=await verifier.verify(jwt);
  assert.equal(principal.id,'https://id.example.com|tenant-a|user-1');
  assert.equal(principal.trustDomain,'https://id.example.com/tenant-a');
  await assert.rejects(()=>verifier.verify(token(privateKey,{alg:'RS256',kid:'kid-1'},{iss:'https://evil.example',aud:'forgeos',sub:'x',exp:now+10,tenant_id:'tenant-a'})),/issuer/i);
  await assert.rejects(()=>verifier.verify(token(privateKey,{alg:'RS256',kid:'kid-1'},{iss:'https://id.example.com',aud:'other',sub:'x',exp:now+10,tenant_id:'tenant-a'})),/audience/i);
  await assert.rejects(()=>verifier.verify(token(privateKey,{alg:'RS256',kid:'kid-1'},{iss:'https://id.example.com',aud:'forgeos',sub:'x',exp:now-31,tenant_id:'tenant-a'})),/expired/i);
});

test('external PDP fails closed and cache is bounded by policy revision and short TTL',async()=>{
  let calls=0; let now=1000;
  const pdp=new ExternalPolicyDecisionPoint({endpoint:'https://pdp.example/v1/data/forgeos/allow',policyRevision:'r1',clock:()=>now,ttlMs:50,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({result:{allow:true,reason:'approved'}})}}});
  const input={principal:{id:'p',roles:['admin']},action:'federation.promote',resource:{tenantId:'t'}};
  assert.equal((await pdp.decide(input)).allow,true); assert.equal((await pdp.decide(input)).allow,true); assert.equal(calls,1);
  now+=60; await pdp.decide(input); assert.equal(calls,2);
  const denied=new ExternalPolicyDecisionPoint({endpoint:'https://pdp.example',fetchImpl:async()=>{throw new Error('offline')},timeoutMs:5});
  const result=await denied.decide(input); assert.equal(result.allow,false); assert.match(result.reason,/unavailable|timeout/i);
});

test('federation authorization requires tenant-scoped roles and denies dangerous actions without human admin',()=>{
  const admin={id:'u',type:'human',roles:['federation-admin'],scopes:['tenant:tenant-a'],trustDomain:'issuer/tenant-a'};
  assert.equal(authorizeFederationAction({principal:admin,tenantId:'tenant-a',action:'provider.promote',provider:{riskClass:'medium'}}).allow,true);
  assert.equal(authorizeFederationAction({principal:admin,tenantId:'tenant-b',action:'provider.promote',provider:{riskClass:'medium'}}).allow,false);
  assert.equal(authorizeFederationAction({principal:{...admin,type:'agent'},tenantId:'tenant-a',action:'provider.promote',provider:{riskClass:'critical'}}).allow,false);
});

test('HTTP accepts verified OIDC bearer identities and rejects unverified JWTs without anonymous fallback',async()=>{
  const { mkdtemp, rm }=await import('node:fs/promises');
  const { tmpdir }=await import('node:os');
  const path=(await import('node:path')).default;
  const { createHttpServer }=await import('../src/server/http-server.mjs');
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk=publicKey.export({format:'jwk'});jwk.kid='http-key';jwk.alg='RS256';
  const now=Math.floor(Date.now()/1000);
  const verifier=new OidcVerifier({issuer:'https://id.example.com',audience:'forgeos',jwks:async()=>({keys:[jwk]}),clock:()=>now});
  const good=token(privateKey,{alg:'RS256',kid:'http-key'},{iss:'https://id.example.com',aud:'forgeos',sub:'user-http',exp:now+60,iat:now,tenant_id:'tenant-a',roles:['operator']});
  const root=await mkdtemp(path.join(tmpdir(),'forge-oidc-'));
  const server=createHttpServer({dataDir:root,publicBaseUrl:'http://127.0.0.1:0',allowedOrigins:['http://127.0.0.1'],oidcVerifier:verifier});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  try{
    const ok=await fetch(`http://127.0.0.1:${port}/dashboard`,{headers:{authorization:`Bearer ${good}`}});assert.equal(ok.status,200);
    const bad=await fetch(`http://127.0.0.1:${port}/dashboard`,{headers:{authorization:'Bearer bad.jwt.value'}});assert.equal(bad.status,401);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});

test('HTTP request accounting drains in-flight work and graceful shutdown stops readiness before close', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = (await import('node:path')).default;
  const { createHttpServer } = await import('../src/server/http-server.mjs');
  const { RuntimeLifecycle } = await import('../src/production/runtime-lifecycle.mjs');
  const lifecycle = new RuntimeLifecycle({ checks: { repository: async () => true, federation: async () => true }, shutdownTimeoutMs: 2000 });
  const root = await mkdtemp(path.join(tmpdir(), 'forge-drain-'));
  const server = createHttpServer({ dataDir: root, publicBaseUrl: 'http://127.0.0.1:0', allowedOrigins: ['http://127.0.0.1'], apiKey: 'test-key', runtimeLifecycle: lifecycle });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/dashboard`, { headers: { authorization: 'Bearer test-key' } });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal((await lifecycle.status()).inFlight, 0);
    await server.gracefulShutdown();
    const state = await lifecycle.status();
    assert.equal(state.state, 'stopped');
    assert.equal(state.ready, false);
    assert.equal(server.listening, false);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
