import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';

async function serverContext(t, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-http-v2-'));
  const server = createHttpServer({
    dataDir: dir,
    publicBaseUrl: 'https://forge.example',
    allowedOrigins: ['https://chatgpt.com', 'https://forge.example'],
    apiKeys: { 'test-secret': { id: 'human:test', type: 'human', roles: ['owner'], scopes: ['*'] } },
    ...options,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

const headers = (extra = {}) => ({
  authorization: 'Bearer test-secret',
  origin: 'https://chatgpt.com',
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  ...extra,
});

async function initSession(base) {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'http-test', version: '1' } } }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('mcp-session-id');
}

test('Streamable HTTP rejects untrusted Origin and does not trust Host for public URLs', async (t) => {
  const base = await serverContext(t);
  const evil = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers({ origin: 'https://evil.example' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'evil', version: '1' } } }),
  });
  assert.equal(evil.status, 403);

  const card = await fetch(`${base}/.well-known/agent-card.json`, { headers: { host: 'attacker.example' } });
  const json = await card.json();
  assert.equal(json.supportedInterfaces[0].url, 'https://forge.example/a2a');
});

test('Streamable HTTP exposes GET endpoint as 405 when SSE is not supported', async (t) => {
  const base = await serverContext(t);
  const response = await fetch(`${base}/mcp`, { headers: { accept: 'text/event-stream', authorization: 'Bearer test-secret', origin: 'https://chatgpt.com' } });
  assert.equal(response.status, 405);
  assert.match(response.headers.get('allow'), /POST/);
});

test('Streamable HTTP requires Accept media types', async (t) => {
  const base = await serverContext(t);
  const response = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers({ accept: 'application/json' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'bad-accept', version: '1' } } }),
  });
  assert.equal(response.status, 406);
});

test('Streamable HTTP creates a session and enforces session/version headers after initialize', async (t) => {
  const base = await serverContext(t);
  const sessionId = await initSession(base);
  assert.match(sessionId, /^[A-Za-z0-9_-]{20,}$/);

  const noSession = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers({ 'mcp-protocol-version': '2025-11-25' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} }),
  });
  assert.equal(noSession.status, 400);

  const wrongVersion = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers({ 'mcp-session-id': sessionId, 'mcp-protocol-version': '1900-01-01' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping', params: {} }),
  });
  assert.equal(wrongVersion.status, 400);

  const initialized = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers({ 'mcp-session-id': sessionId, 'mcp-protocol-version': '2025-11-25' }),
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  assert.equal(initialized.status, 202);
  assert.equal(await initialized.text(), '');

  const ping = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers({ 'mcp-session-id': sessionId, 'mcp-protocol-version': '2025-11-25' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'ping', params: {} }),
  });
  assert.equal(ping.status, 200);
  assert.deepEqual((await ping.json()).result, {});
});

test('HTTP errors use stable public shape with request IDs', async (t) => {
  const base = await serverContext(t);
  const result = await fetch(`${base}/mcp`, { method: 'POST', headers: headers(), body: '{' });
  assert.equal(result.status, 400);
  const body = await result.json();
  assert.equal(body.error.code, 'invalid_json');
  assert.ok(body.error.requestId);
  assert.equal(typeof body.error.message, 'string');
});

test('rate limiter protects protocol endpoints', async (t) => {
  const base = await serverContext(t, { rateLimit: { windowMs: 60_000, max: 2 } });
  const request = () => fetch(`${base}/mcp`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'rate', version: '1' } } }),
  });
  assert.equal((await request()).status, 200);
  assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});

test('Forge Studio HTTP CSP uses the generated nonce and never enables unsafe-inline scripts or styles',async(t)=>{
  const base=await serverContext(t);
  const response=await fetch(`${base}/dashboard`,{headers:{authorization:'Bearer test-secret'}});
  const html=await response.text();
  const nonce=/<(?:script|style) nonce="([^"]+)"/.exec(html)?.[1];
  const csp=response.headers.get('content-security-policy')??'';
  assert.ok(nonce);
  assert.match(csp,new RegExp(`script-src 'nonce-${nonce}'`));
  assert.match(csp,new RegExp(`style-src 'nonce-${nonce}'`));
  assert.doesNotMatch(csp,/unsafe-inline/);
});

test('MCP session termination is owner-bound and version-bound',async(t)=>{
  const base=await serverContext(t,{apiKeys:{
    'test-secret':{id:'human:test',type:'human',roles:['owner'],scopes:['*'],trustDomain:'team:a'},
    'other-secret':{id:'human:other',type:'human',roles:['owner'],scopes:['*'],trustDomain:'team:b'},
  }});
  const sessionId=await initSession(base);
  const foreign=await fetch(`${base}/mcp`,{method:'DELETE',headers:headers({authorization:'Bearer other-secret','mcp-session-id':sessionId,'mcp-protocol-version':'2025-11-25'})});
  assert.equal(foreign.status,403);
  const missingVersion=await fetch(`${base}/mcp`,{method:'DELETE',headers:headers({'mcp-session-id':sessionId})});
  assert.equal(missingVersion.status,400);
  const owner=await fetch(`${base}/mcp`,{method:'DELETE',headers:headers({'mcp-session-id':sessionId,'mcp-protocol-version':'2025-11-25'})});
  assert.equal(owner.status,204);
});

test('invalid initialize does not allocate or expose a session',async(t)=>{
  const base=await serverContext(t);
  const response=await fetch(`${base}/mcp`,{method:'POST',headers:headers(),body:JSON.stringify({jsonrpc:'2.0',id:9,method:'initialize',params:{protocolVersion:'1900-01-01',capabilities:{},clientInfo:{name:'bad',version:'1'}}})});
  assert.equal(response.status,400);
  assert.equal(response.headers.get('mcp-session-id'),null);
});

test('CORS exposes protocol session and diagnostics headers to allowed browser origins',async(t)=>{
  const base=await serverContext(t);
  const response=await fetch(`${base}/mcp`,{method:'POST',headers:headers(),body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'browser',version:'1'}}})});
  const exposed=response.headers.get('access-control-expose-headers')??'';
  assert.match(exposed,/mcp-session-id/i);
  assert.match(exposed,/x-request-id/i);
});

test('embedded HTTP server is fail-closed unless anonymous local mode is explicit',()=>{
  assert.throws(()=>createHttpServer({publicBaseUrl:'http://127.0.0.1:8787'}),/authentication.*anonymous local/i);
  const server=createHttpServer({publicBaseUrl:'http://127.0.0.1:8787',allowAnonymousLocal:true});
  server.close();
});

test('expired MCP sessions are reclaimed before enforcing session capacity', async (t) => {
  const base = await serverContext(t, { maxSessions: 1, sessionTtlMs: 20, rateLimit: { windowMs: 60_000, max: 10 } });
  await initSession(base);
  await new Promise((resolve) => setTimeout(resolve, 35));
  const replacement = await fetch(`${base}/mcp`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'replacement', version: '1' } } }),
  });
  assert.equal(replacement.status, 200);
  assert.match(replacement.headers.get('mcp-session-id'), /^[A-Za-z0-9_-]{20,}$/);
});
