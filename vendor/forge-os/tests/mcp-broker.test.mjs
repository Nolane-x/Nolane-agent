import test from 'node:test';
import assert from 'node:assert/strict';
import { McpBroker, StreamableHttpMcpTransportFactory } from '../src/federation/mcp-broker.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { PRODUCT } from '../src/core/constants.mjs';

const human = createPrincipal({ id: 'human-admin', type: 'human', roles: ['mcp-operator'], scopes: ['tenant:tenant-a'], trustDomain: 'issuer/tenant-a' });
const agent = createPrincipal({ id: 'agent-worker', type: 'agent', roles: ['worker'], scopes: ['tenant:tenant-a'], trustDomain: 'issuer/tenant-a' });
function provider({ readOnly = true } = {}) {
  return {
    providerId: 'mcp.example', capabilityId: 'api-integration.integrate-dependencies', sourceId: 'official-mcp-registry', sourceCoordinate: 'registry:v1',
    contentDigest: 'a'.repeat(64), providerDigest: 'b'.repeat(64), kind: 'mcp', status: 'stable', builtIn: false,
    trust: { score: 95, blockers: [] }, scanReceipt: { status: 'pass', providerDigest: 'b'.repeat(64) },
    compatibility: { agents: ['*'], tools: [] }, material: { server: { publisherVerified: true, remotes: [{ type: 'streamable-http', url: 'https://mcp.example.test/mcp' }], tools: [{ name: 'lookup', annotations: { readOnlyHint: readOnly } }] } },
  };
}

test('MCP broker executes only stable scanned allowlisted tools and emits content-addressed audit receipt', async () => {
  let closed = false;
  const broker = new McpBroker({
    providerLoader: async () => [provider()],
    transportFactory: { connect: async () => ({ callTool: async (name, args) => ({ content: [{ type: 'text', text: `${name}:${args.query}` }], structuredContent: { ok: true } }), close: async () => { closed = true; } }) },
  });
  const result = await broker.execute({ providerId: 'mcp.example', toolName: 'lookup', arguments: { query: 'forge' }, tenantId: 'tenant-a' }, { principal: agent });
  assert.equal(result.output.structuredContent.ok, true);
  assert.equal(closed, true);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.receipt.providerDigest, provider().providerDigest);
  assert.equal(Object.hasOwn(result.receipt, 'output'), false, 'audit receipt must not duplicate tool output');
});

test('MCP broker rejects untrusted providers, undeclared tools, inline secrets, and agent write execution', async () => {
  const transportFactory = { connect: async () => ({ callTool: async () => ({}), close: async () => {} }) };
  const broker = new McpBroker({ providerLoader: async () => [provider({ readOnly: false })], transportFactory });
  await assert.rejects(() => broker.execute({ providerId: 'mcp.example', toolName: 'missing', arguments: {}, tenantId: 'tenant-a' }, { principal: human }), /not declared/i);
  await assert.rejects(() => broker.execute({ providerId: 'mcp.example', toolName: 'lookup', arguments: { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz123456' }, tenantId: 'tenant-a' }, { principal: human }), /secret/i);
  await assert.rejects(() => broker.execute({ providerId: 'mcp.example', toolName: 'lookup', arguments: {}, tenantId: 'tenant-a' }, { principal: agent }), /human mcp operator/i);
});

test('Streamable HTTP MCP transport negotiates lifecycle, forwards session, and terminates it', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
    const request = init.body ? JSON.parse(init.body) : null;
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    if (request.method === 'initialize') return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'test', version: '1' } } }), { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-1' } });
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { structuredContent: { ok: true } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const factory = new StreamableHttpMcpTransportFactory({ fetchImpl });
  const transport = await factory.connect(provider(), { headers: { authorization: 'Bearer opaque' } });
  assert.deepEqual(await transport.callTool('lookup', { query: 'x' }), { structuredContent: { ok: true } });
  await transport.close();
  assert.equal(calls.length, 4);
  assert.equal(JSON.parse(calls[0].body).params.clientInfo.version, PRODUCT.version);
  assert.equal(calls[2].headers['mcp-session-id'], 'session-1');
  assert.equal(calls[3].method, 'DELETE');
});

test('MCP broker keeps receipts local to each execution and does not retain shared receipt state', async () => {
  const broker = new McpBroker({
    providerLoader: async () => [provider()],
    transportFactory: {
      connect: async () => ({
        callTool: async (_name, args) => {
          await new Promise((resolve) => setTimeout(resolve, args.delay));
          return { structuredContent: { request: args.request } };
        },
        close: async () => {},
      }),
    },
  });
  const [slow, fast] = await Promise.all([
    broker.execute({ providerId: 'mcp.example', toolName: 'lookup', arguments: { request: 'slow', delay: 20 }, tenantId: 'tenant-a' }, { principal: agent }),
    broker.execute({ providerId: 'mcp.example', toolName: 'lookup', arguments: { request: 'fast', delay: 1 }, tenantId: 'tenant-a' }, { principal: agent }),
  ]);
  assert.notEqual(slow.receipt.receiptSha256, fast.receipt.receiptSha256);
  assert.equal(slow.receipt.inputSha256 === fast.receipt.inputSha256, false);
  assert.equal(Object.hasOwn(broker, 'lastReceipt'), false, 'broker must not retain a shared mutable receipt between calls');
});

test('MCP broker honors an already-aborted execution signal without waiting for timeout', async () => {
  const controller=new AbortController();controller.abort(new Error('caller aborted'));
  const broker=new McpBroker({
    providerLoader:async()=>[provider()],timeoutMs:1000,
    transportFactory:{connect:async()=>({callTool:async()=>new Promise(()=>{}),close:async()=>{}})},
  });
  await assert.rejects(
    Promise.race([
      broker.execute({providerId:'mcp.example',toolName:'lookup',arguments:{},tenantId:'tenant-a'},{principal:agent,signal:controller.signal}),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('abort was not observed')),50)),
    ]),
    /caller aborted|aborted/i,
  );
});

test('Streamable HTTP MCP transport parses a JSON-RPC response delivered as server-sent events', async () => {
  const fetchImpl = async (_url, init) => {
    const request = init.body ? JSON.parse(init.body) : null;
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    if (request.method === 'initialize') return new Response(JSON.stringify({ jsonrpc:'2.0', id:request.id, result:{ protocolVersion:'2025-11-25', capabilities:{}, serverInfo:{name:'sse',version:'1'} } }), { status:200, headers:{'content-type':'application/json','mcp-session-id':'sse-session'} });
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
    const event = `event: message\ndata: ${JSON.stringify({jsonrpc:'2.0',id:request.id,result:{structuredContent:{via:'sse'}}})}\n\n`;
    return new Response(event, { status:200, headers:{'content-type':'text/event-stream'} });
  };
  const transport = await new StreamableHttpMcpTransportFactory({fetchImpl}).connect(provider());
  assert.deepEqual(await transport.callTool('lookup',{}),{structuredContent:{via:'sse'}});
  await transport.close();
});

test('MCP broker aborts the underlying tool execution when its timeout expires', async () => {
  let aborted = false;
  const broker = new McpBroker({
    providerLoader: async () => [provider()],
    timeoutMs: 20,
    transportFactory: { connect: async (_provider,{signal}) => ({
      callTool: async () => new Promise((_resolve,reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(signal.reason ?? new Error('aborted')); }, {once:true});
      }),
      close: async () => {},
    }) },
  });
  await assert.rejects(() => broker.execute({providerId:'mcp.example',toolName:'lookup',arguments:{},tenantId:'tenant-a'},{principal:agent}),/timed out|abort/i);
  assert.equal(aborted,true);
});
