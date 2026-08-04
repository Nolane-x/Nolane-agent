import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';

async function serverContext(t,options={}){const dir=await mkdtemp(path.join(tmpdir(),'forge-http-'));const server=createHttpServer({dataDir:dir,publicBaseUrl:'https://forge.example',allowedOrigins:['https://chatgpt.com'],allowAnonymousLocal:true,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});return `http://127.0.0.1:${server.address().port}`;}
const protocolHeaders=(extra={})=>({'content-type':'application/json',accept:'application/json, text/event-stream',origin:'https://chatgpt.com',...extra});
async function init(base,extra={}){const r=await fetch(`${base}/mcp`,{method:'POST',headers:protocolHeaders(extra),body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'http-test',version:'1'}}})});return r;}

test('HTTP server exposes health, Studio, A2A discovery, and negotiated MCP',async t=>{const base=await serverContext(t);assert.equal((await fetch(`${base}/health`)).status,200);assert.match(await (await fetch(`${base}/dashboard`)).text(),/ForgeOS/);const card=await (await fetch(`${base}/.well-known/agent-card.json`)).json();assert.equal(card.supportedInterfaces[0].url,'https://forge.example/a2a');const initialized=await init(base);assert.equal(initialized.status,200);assert.equal(initialized.headers.get('mcp-protocol-version'),'2025-11-25');});

test('HTTP server enforces bounded JSON after transport negotiation and rejects content types',async t=>{const base=await serverContext(t,{maxBodyBytes:200});const oversized=await fetch(`${base}/mcp`,{method:'POST',headers:protocolHeaders(),body:JSON.stringify({data:'x'.repeat(1000)})});assert.equal(oversized.status,413);const wrong=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'text/plain',accept:'application/json, text/event-stream',origin:'https://chatgpt.com'},body:'{}'});assert.equal(wrong.status,415);});

test('bearer key protects operational endpoints while discovery stays public',async t=>{const base=await serverContext(t,{apiKeys:{'test-secret':{id:'human:test',type:'human',roles:['owner'],scopes:['*']}}});assert.equal((await fetch(`${base}/.well-known/agent-card.json`)).status,200);assert.equal((await fetch(`${base}/dashboard`)).status,401);assert.equal((await init(base)).status,401);assert.equal((await init(base,{authorization:'Bearer test-secret'})).status,200);});
