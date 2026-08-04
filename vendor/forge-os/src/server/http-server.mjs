import { createServer } from 'node:http';
import { timingSafeEqual, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectStore } from '../storage/project-store-factory.mjs';
import { ForgeOrchestrator } from '../core/orchestrator.mjs';
import { boundedJsonParse } from '../core/security.mjs';
import { createPrincipal } from '../core/principals.mjs';
import { PRODUCT } from '../core/constants.mjs';
import { createMcpSession, handleMcpRpc } from './mcp.mjs';
import { SkillIntelligenceService } from '../intelligence/service.mjs';
import { V06RuntimeService } from '../v06/service.mjs';
import { agentCard, handleA2aRpc } from './a2a.mjs';
import { A2aTaskStore } from './a2a-task-store.mjs';
import { SqliteA2aTaskStore } from '../storage/sqlite-a2a-task-store.mjs';
import { renderForgeStudioHtml } from '../ui/forge-studio.mjs';
import { FederationCatalogStore } from '../federation/catalog-store.mjs';
import { SqliteFederationCatalogStore } from '../storage/sqlite-federation-store.mjs';
import { FederationService } from '../federation/service.mjs';
import { McpRegistryClient } from '../federation/mcp-registry-client.mjs';
import { McpBroker, StreamableHttpMcpTransportFactory } from '../federation/mcp-broker.mjs';
import { FederationSynchronizer, GitHubRepositoryFetcher } from '../federation/synchronizer.mjs';
import { loadFederationSources } from '../federation/source-registry.mjs';
import { loadCapabilityCatalog } from '../federation/capability-catalog.mjs';
import { MetricsRegistry } from '../production/metrics.mjs';
import { RuntimeLifecycle } from '../production/runtime-lifecycle.mjs';
import { FederationEvaluationStore } from '../evals/federation-eval-store.mjs';
import { SqliteFederationEvaluationStore } from '../storage/sqlite-federation-eval-store.mjs';

const DEFAULT_MAX_BODY = 1_000_000;
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_RATE_LIMIT = Object.freeze({ windowMs: 60_000, max: 120 });

function json(res,status,value,headers={}) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});
  res.end(`${JSON.stringify(value)}\n`);
}
function html(res,status,value,headers={}) {
  const nonce=/<(?:script|style) nonce="([^"]+)"/.exec(value)?.[1];
  const csp=nonce
    ? `default-src 'none'; img-src 'self' data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self' https://chatgpt.com https://chat.openai.com`
    : "default-src 'none'; img-src data:; connect-src 'self'";
  res.writeHead(status,{'content-type':'text/html; charset=utf-8','content-security-policy':csp,'x-content-type-options':'nosniff',...headers});
  res.end(value);
}
async function readBody(req,maxBytes) {
  let size=0; const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>maxBytes){const error=new RangeError('Request body is too large');error.status=413;error.code='body_too_large';throw error;}
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function safeEqual(actual, expected) {
  const a=Buffer.from(actual); const b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}

function normalizeApiKeys(apiKeys, apiKey) {
  if (apiKeys && typeof apiKeys === 'object') return new Map(Object.entries(apiKeys));
  if (apiKey) return new Map([[apiKey,{id:'service:legacy-api-key',type:'service',roles:['operator'],scopes:['*']}]]);
  return new Map();
}

async function authenticate(req, keys, oidcVerifier, allowAnonymousLocal) {
  const header=String(req.headers.authorization??'');
  if(header.startsWith('Bearer ')){
    const presented=header.slice(7);
    for(const [token,identity] of keys) if(safeEqual(presented,token)) return createPrincipal(identity);
    if(oidcVerifier){try{return await oidcVerifier.verify(presented);}catch{return null;}}
    return null;
  }
  if(keys.size===0&&!oidcVerifier&&allowAnonymousLocal) return createPrincipal({id:'service:local-anonymous',type:'service',roles:['local'],scopes:['*']});
  return null;
}

function stableError(code,message,requestId,details) {
  return {error:{code,message,requestId,...(details?{details}:{})}};
}

function createRateLimiter({windowMs,max,maxBuckets=10_000}) {
  const buckets=new Map();
  return (key,now=Date.now())=>{
    for (const [candidate,bucket] of buckets) if (bucket.resetAt<=now) buckets.delete(candidate);
    if (buckets.size>=maxBuckets&&!buckets.has(key)) buckets.delete(buckets.keys().next().value);
    let bucket=buckets.get(key);
    if(!bucket||bucket.resetAt<=now){bucket={count:0,resetAt:now+windowMs};buckets.set(key,bucket);}
    bucket.count+=1;
    return {allowed:bucket.count<=max,retryAfter:Math.max(1,Math.ceil((bucket.resetAt-now)/1000)),remaining:Math.max(0,max-bucket.count)};
  };
}

function parsePublicUrl(value) {
  const url=new URL(String(value));
  if(!['http:','https:'].includes(url.protocol)) throw new TypeError('publicBaseUrl must use http or https');
  if(url.username||url.password||url.search||url.hash) throw new TypeError('publicBaseUrl must not contain credentials, query, or fragment');
  return url.toString().replace(/\/$/,'');
}


function validOrigin(origin, allowedOrigins) {
  if(!origin) return true;
  return allowedOrigins.has(origin);
}

function acceptsMcp(req) {
  const accept=String(req.headers.accept??'').toLowerCase();
  return accept.includes('application/json') && accept.includes('text/event-stream');
}

export function createHttpServer({
  dataDir=path.resolve('.forgeos-data'),
  maxBodyBytes=DEFAULT_MAX_BODY,
  publicBaseUrl='http://127.0.0.1:8787',
  allowedOrigins=null,
  allowOrigin=null,
  apiKeys=null,
  apiKey=null,
  rateLimit=DEFAULT_RATE_LIMIT,
  sessionTtlMs=DEFAULT_SESSION_TTL_MS,
  requestTimeoutMs=30_000,
  headersTimeoutMs=15_000,
  keepAliveTimeoutMs=5_000,
  logger=null,
  evidenceProviders=null,
  allowAnonymousLocal=false,
  maxSessions=5_000,
  federationService=null,
  metricsRegistry=null,
  runtimeLifecycle=null,
  oidcVerifier=null,
  projectStore=null,
  storageBackend='sqlite',
  federationCatalogStore=null,
  mcpBroker=null,
  intelligenceService=null,
  v06Service=null,
}={}) {
  const store=projectStore??createProjectStore({backend:storageBackend,dataDir});
  const forge=new ForgeOrchestrator(store,{evidenceProviders});
  const a2aTaskStore=storageBackend==='sqlite'?new SqliteA2aTaskStore(path.join(dataDir,'forgeos.sqlite')):new A2aTaskStore(path.join(dataDir,'.a2a-tasks'));
  const federationStore=federationCatalogStore??(storageBackend==='sqlite'?new SqliteFederationCatalogStore(path.join(dataDir,'forgeos.sqlite')):new FederationCatalogStore(path.join(dataDir,'.federation')));
  const federationEvalStore=storageBackend==='sqlite'?new SqliteFederationEvaluationStore(path.join(dataDir,'forgeos.sqlite')):new FederationEvaluationStore(path.join(dataDir,'.federation-evals'));
  const intelligence=intelligenceService??new SkillIntelligenceService();
  const v06=v06Service??new V06RuntimeService();
  const federation=federationService??new FederationService({catalogStore:federationStore,evaluationStore:federationEvalStore,mcpRegistryClient:new McpRegistryClient()});
  if(!federation.mcpBroker)federation.setMcpBroker(mcpBroker??new McpBroker({providerLoader:(tenantId)=>federation.loadProvidersForTenant(tenantId),transportFactory:new StreamableHttpMcpTransportFactory()}));
  if(!federation.synchronizer)federation.setSynchronizer(new FederationSynchronizer({
    service:federation,
    sourcesLoader:loadFederationSources,
    capabilityLoader:loadCapabilityCatalog,
    fetchers:{
      'agent-skills-repository':new GitHubRepositoryFetcher(),
      'skills-cli-repository':new GitHubRepositoryFetcher(),
    },
  }));
  const metrics=metricsRegistry??new MetricsRegistry({service:'forgeos'});
  const lifecycle=runtimeLifecycle??new RuntimeLifecycle({checks:{repository:async()=>typeof store.health==='function'?(await store.health()).ok:true,federation:async()=>{try{await federation.status();return true;}catch{return false;}}}});
  if(lifecycle.state==='starting')lifecycle.markStarted();
  const baseUrl=parsePublicUrl(publicBaseUrl);
  const origins=new Set((allowedOrigins??(allowOrigin?[allowOrigin]:[new URL(baseUrl).origin])).map((value)=>new URL(String(value)).origin));
  const keys=normalizeApiKeys(apiKeys,apiKey);
  if(keys.size===0&&!oidcVerifier&&!allowAnonymousLocal) throw new Error('Authentication is required unless anonymous local mode is explicitly enabled');
  const sessions=new Map();
  const limit=createRateLimiter(rateLimit);

  function cors(req) {
    const origin=String(req.headers.origin??'');
    return {
      ...(origin&&origins.has(origin)?{'access-control-allow-origin':origin,'vary':'origin'}:{}),
      'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers':'content-type,accept,mcp-protocol-version,mcp-session-id,authorization,a2a-version',
      'access-control-expose-headers':'mcp-session-id,mcp-protocol-version,x-request-id,retry-after,x-ratelimit-remaining',
      'mcp-protocol-version':PRODUCT.protocolTargets.mcp,
    };
  }

  const server=createServer(async(req,res)=>{
    const requestId=`req_${randomUUID().replaceAll('-','')}`;
    res.setHeader('x-request-id',requestId);
    const url=new URL(req.url??'/','http://forgeos.internal');
    const origin=String(req.headers.origin??'');
    try{metrics.counter('forgeos_http_requests_total',{route:url.pathname,status_class:'received'}).inc();}catch{}
    const protocolEndpoint=url.pathname==='/mcp'||url.pathname==='/a2a';
    const responseHeaders=cors(req);
    const lifecycleExempt=new Set(['/health','/livez','/readyz','/metrics']);
    let releaseRequest=null;
    if(!lifecycleExempt.has(url.pathname)){
      try{releaseRequest=lifecycle.beginRequest();res.once('finish',releaseRequest);res.once('close',releaseRequest);}
      catch{json(res,503,stableError('runtime_draining','ForgeOS is draining and is not accepting new work.',requestId),responseHeaders);return;}
    }

    try {
      const sweepAt=Date.now();
      for(const [candidate,entry] of sessions) if(sweepAt-entry.lastSeen>sessionTtlMs) sessions.delete(candidate);
      if(protocolEndpoint&&!validOrigin(origin,origins)){
        json(res,403,stableError('origin_forbidden','Origin is not allowed.',requestId),responseHeaders);return;
      }
      if(req.method==='OPTIONS'){
        if(!validOrigin(origin,origins)){json(res,403,stableError('origin_forbidden','Origin is not allowed.',requestId),responseHeaders);return;}
        res.writeHead(204,responseHeaders);res.end();return;
      }
      if(req.method==='GET'&&url.pathname==='/health'){const state=await lifecycle.status();json(res,state.ready?200:503,{name:'ForgeOS',version:PRODUCT.version,status:state.ready?'ok':'not-ready',protocols:PRODUCT.protocolTargets,runtime:state},responseHeaders);return;}
      if(req.method==='GET'&&url.pathname==='/livez'){const state=await lifecycle.status();json(res,state.live?200:503,{live:state.live,state:state.state},responseHeaders);return;}
      if(req.method==='GET'&&url.pathname==='/readyz'){const state=await lifecycle.status();json(res,state.ready?200:503,state,responseHeaders);return;}
      if(req.method==='GET'&&url.pathname==='/metrics'){res.writeHead(200,{'content-type':'text/plain; version=0.0.4; charset=utf-8','cache-control':'no-store',...responseHeaders});res.end(metrics.renderPrometheus());return;}
      if(req.method==='GET'&&(url.pathname==='/.well-known/agent-card.json'||url.pathname==='/.well-known/agent.json')){json(res,200,agentCard(baseUrl),responseHeaders);return;}

      const principal=await authenticate(req,keys,oidcVerifier,allowAnonymousLocal);
      if(!principal){json(res,401,stableError('unauthorized','Authentication is required.',requestId),{...responseHeaders,'www-authenticate':'Bearer realm="forgeos"'});return;}

      const rateKey=`${principal.id}:${req.socket.remoteAddress??'unknown'}`;
      const rate=limit(rateKey);
      if(!rate.allowed){json(res,429,stableError('rate_limited','Too many requests.',requestId),{...responseHeaders,'retry-after':String(rate.retryAfter),'x-ratelimit-remaining':'0'});return;}

      if(req.method==='GET'&&url.pathname==='/docs'){
        html(res,200,`<!doctype html><html><head><meta charset="utf-8"><title>ForgeOS Documentation</title></head><body><main><h1>ForgeOS Documentation</h1><p>Use the repository documentation for architecture, protocols, skills, testing, and security.</p><ul><li><a href="https://github.com/forgeos/forge-os/blob/main/docs/ARCHITECTURE.md">Architecture</a></li><li><a href="https://github.com/forgeos/forge-os/blob/main/docs/PROTOCOLS.md">Protocols</a></li><li><a href="https://github.com/forgeos/forge-os/blob/main/docs/SECURITY-MODEL.md">Security model</a></li></ul></main></body></html>`,responseHeaders);return;
      }
      if(req.method==='GET'&&url.pathname==='/dashboard'){
        const listed=await forge.listProjects({principal});
        const projects=Array.isArray(listed)?listed:listed.projects??[];
        const scopedTenant=principal.scopes?.find((scope)=>scope.startsWith('tenant:'))?.slice(7);
        const tenantId=String(url.searchParams.get('tenantId')??scopedTenant??'default').trim();
        let federationState=null;try{federationState=await federation.audit({tenantId},{principal});}catch{federationState={healthy:false};}
        let intelligenceState=null;let v06State=null;try{[intelligenceState,v06State]=await Promise.all([intelligence.status(),v06.status()]);}catch{}
        html(res,200,renderForgeStudioHtml({tenantId,projects,project:projects[0],federation:federationState,skillIntelligence:intelligenceState,v06:v06State}),responseHeaders);return;
      }
      if(req.method==='GET'&&url.pathname==='/mcp'){
        res.writeHead(405,{...responseHeaders,allow:'POST, DELETE'});res.end();return;
      }
      if(req.method==='DELETE'&&url.pathname==='/mcp'){
        const protocolVersion=String(req.headers['mcp-protocol-version']??'');
        if(protocolVersion!==PRODUCT.protocolTargets.mcp){json(res,400,stableError('unsupported_protocol_version','MCP-Protocol-Version is missing or unsupported.',requestId,{supported:[PRODUCT.protocolTargets.mcp]}),responseHeaders);return;}
        const sessionId=String(req.headers['mcp-session-id']??'');
        const entry=sessions.get(sessionId);
        if(!sessionId||!entry){json(res,404,stableError('session_not_found','MCP session was not found.',requestId),responseHeaders);return;}
        if(entry.principalId!==principal.id){json(res,403,stableError('session_principal_mismatch','MCP session belongs to another principal.',requestId),responseHeaders);return;}
        sessions.delete(sessionId);res.writeHead(204,responseHeaders);res.end();return;
      }
      if(req.method==='POST'&&(url.pathname==='/mcp'||url.pathname==='/a2a')){
        if(!(req.headers['content-type']??'').toLowerCase().startsWith('application/json')){json(res,415,stableError('unsupported_media_type','Content-Type must be application/json.',requestId),responseHeaders);return;}
        if(url.pathname==='/mcp'&&!acceptsMcp(req)){json(res,406,stableError('not_acceptable','Accept must include application/json and text/event-stream.',requestId),responseHeaders);return;}
        let request;
        try { request=boundedJsonParse(await readBody(req,maxBodyBytes),maxBodyBytes); }
        catch(cause) {
          const status=cause.status??(cause instanceof RangeError?413:400);
          const code=cause.code??(status===413?'body_too_large':'invalid_json');
          json(res,status,stableError(code,status===413?'Request body is too large.':'Request body is not valid JSON.',requestId),responseHeaders);return;
        }

        if(url.pathname==='/mcp'){
          const isInitialize=request?.jsonrpc==='2.0'&&request?.method==='initialize'&&Object.hasOwn(request,'id');
          let sessionId=String(req.headers['mcp-session-id']??'');
          let session;
          if(isInitialize){
            if(sessionId){json(res,400,stableError('unexpected_session','Initialize must not include an MCP session ID.',requestId),responseHeaders);return;}
            if(request?.params?.protocolVersion!==PRODUCT.protocolTargets.mcp){json(res,400,stableError('unsupported_protocol_version','Requested MCP protocol version is unsupported.',requestId,{supported:[PRODUCT.protocolTargets.mcp]}),responseHeaders);return;}
            if(sessions.size>=maxSessions){json(res,503,stableError('session_capacity','MCP session capacity has been reached.',requestId),responseHeaders);return;}
            sessionId=randomBytes(24).toString('base64url');
            session=createMcpSession({id:sessionId});
            sessions.set(sessionId,{session,lastSeen:Date.now(),principalId:principal.id});
          } else {
            const protocolVersion=String(req.headers['mcp-protocol-version']??'');
            if(protocolVersion!==PRODUCT.protocolTargets.mcp){json(res,400,stableError('unsupported_protocol_version','MCP-Protocol-Version is missing or unsupported.',requestId,{supported:[PRODUCT.protocolTargets.mcp]}),responseHeaders);return;}
            const entry=sessions.get(sessionId);
            if(!sessionId||!entry){json(res,400,stableError('session_required','A valid MCP-Session-Id is required.',requestId),responseHeaders);return;}
            if(Date.now()-entry.lastSeen>sessionTtlMs){sessions.delete(sessionId);json(res,404,stableError('session_expired','MCP session expired.',requestId),responseHeaders);return;}
            if(entry.principalId!==principal.id){json(res,403,stableError('session_principal_mismatch','MCP session belongs to another principal.',requestId),responseHeaders);return;}
            entry.lastSeen=Date.now(); session=entry.session;
          }
          const result=await handleMcpRpc(request,{forge,federation,intelligence,v06,baseUrl,principal,session,requestId,logger});
          const headers={...responseHeaders,'mcp-session-id':sessionId};
          if(result===null){res.writeHead(202,headers);res.end();return;}
          json(res,200,result,headers);return;
        }

        const a2aVersion=String(req.headers['a2a-version']??PRODUCT.protocolTargets.a2a);
        if(a2aVersion!==PRODUCT.protocolTargets.a2a){json(res,400,stableError('unsupported_a2a_version','A2A version is unsupported.',requestId,{supported:[PRODUCT.protocolTargets.a2a]}),responseHeaders);return;}
        const result=await handleA2aRpc(request,{forge,taskStore:a2aTaskStore,baseUrl,principal,requestId,logger});
        if(result===null){res.writeHead(202,responseHeaders);res.end();return;}
        json(res,200,result,responseHeaders);return;
      }
      json(res,404,stableError('not_found','Endpoint was not found.',requestId),responseHeaders);
    } catch(cause) {
      try{logger?.({level:'error',event:'http-error',requestId,error:cause?.stack??String(cause)});}catch{}
      json(res,500,stableError('internal_error','The server could not complete the request.',requestId),responseHeaders);
    }
  });
  server.requestTimeout=requestTimeoutMs;
  server.headersTimeout=headersTimeoutMs;
  server.keepAliveTimeout=keepAliveTimeoutMs;
  server.forgeLifecycle=lifecycle;
  server.projectStore=store;
  let storageClosed=false;
  const closeStorage=()=>{if(storageClosed)return;storageClosed=true;try{store.close?.();}catch{}try{federation.close?.();}catch{}try{a2aTaskStore.close?.();}catch{}};
  server.once('close',closeStorage);
  server.gracefulShutdown=()=>lifecycle.shutdown({close:()=>new Promise((resolve,reject)=>{if(!server.listening){closeStorage();resolve();return;}server.close((error)=>{closeStorage();error?reject(error):resolve();});})});
  return server;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.FORGEOS_PORT??process.env.PORT??8787);
  const host=process.env.HOST??'127.0.0.1';
  const token=process.env.FORGEOS_API_KEY??null;
  const insecure=process.env.FORGEOS_ALLOW_INSECURE_NETWORK==='1';
  if(!['127.0.0.1','::1','localhost'].includes(host)&&!token&&!insecure){
    throw new Error('ForgeOS refuses non-loopback binding without authentication. Set FORGEOS_API_KEY or explicitly set FORGEOS_ALLOW_INSECURE_NETWORK=1.');
  }
  const publicBaseUrl=process.env.FORGEOS_PUBLIC_BASE_URL??`http://${host}:${port}`;
  const origins=(process.env.FORGEOS_ALLOWED_ORIGINS??publicBaseUrl).split(',').map((value)=>value.trim()).filter(Boolean);
  const server=createHttpServer({
    dataDir:process.env.FORGEOS_DATA_DIR??path.resolve('.forgeos-data'),
    publicBaseUrl,
    allowedOrigins:origins,
    apiKey:token,
    allowAnonymousLocal:!token&&['127.0.0.1','::1','localhost'].includes(host),
    storageBackend:process.env.FORGEOS_STORAGE_BACKEND??'sqlite',
  });
  server.listen(port,host,()=>console.log(`ForgeOS listening on ${publicBaseUrl}`));
  let shuttingDown=false;
  const shutdown=async(signal)=>{if(shuttingDown)return;shuttingDown=true;try{await server.gracefulShutdown();process.exitCode=0;}catch(error){console.error(`[ForgeOS] ${signal} shutdown failed:`,error);process.exitCode=1;}};
  process.once('SIGTERM',()=>void shutdown('SIGTERM'));
  process.once('SIGINT',()=>void shutdown('SIGINT'));
}
