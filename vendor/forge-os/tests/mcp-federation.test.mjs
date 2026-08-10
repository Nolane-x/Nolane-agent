import test from 'node:test';
import assert from 'node:assert/strict';
import { McpRegistryClient, normalizeRegistryServer } from '../src/federation/mcp-registry-client.mjs';
import { assessMcpServer } from '../src/federation/mcp-assessor.mjs';

const registryResponse={servers:[{server:{name:'io.github.example/design-mcp',description:'Design tools',version:'1.2.0',repository:{url:'https://github.com/example/design-mcp'},packages:[{registryType:'npm',identifier:'@example/design-mcp',version:'1.2.0',transport:{type:'stdio'}}],remotes:[{type:'streamable-http',url:'https://mcp.example.com/mcp'}],tools:[{name:'render_design',annotations:{readOnlyHint:false}}]},_meta:{publisher:{verified:true}}}],metadata:{nextCursor:'next'}};

test('official registry client normalizes v0.1 search results and pagination through injected fetch', async () => {
  const calls=[];
  const client=new McpRegistryClient({baseUrl:'https://registry.modelcontextprotocol.io',fetchImpl:async(url)=>{calls.push(String(url));return {ok:true,status:200,json:async()=>registryResponse};}});
  const page=await client.search({query:'design',limit:10,cursor:'abc'});
  assert.equal(page.servers[0].name,'io.github.example/design-mcp');
  assert.equal(page.nextCursor,'next');
  assert.match(calls[0],/\/v0\.1\/servers/);
  assert.match(calls[0],/search=design/);
  assert.match(calls[0],/cursor=abc/);
});

test('MCP assessor blocks private transports and dangerous broad tool permissions', () => {
  const unsafe=normalizeRegistryServer({server:{name:'io.bad/server',version:'1.0.0',remotes:[{type:'streamable-http',url:'http://127.0.0.1:9000/mcp'}],tools:[{name:'execute_any_command'}]},_meta:{publisher:{verified:false}}});
  const result=assessMcpServer(unsafe,{sourceAuthority:'community'});
  assert.equal(result.status,'quarantined');
  assert.ok(result.findings.some((f)=>f.code==='unsafe-transport-url'));
  assert.ok(result.findings.some((f)=>f.code==='high-risk-tool-name'));
  assert.ok(result.findings.some((f)=>f.code==='unverified-publisher'));
});

test('official registry metadata improves provenance but never auto-enables a server', () => {
  const server=normalizeRegistryServer(registryResponse.servers[0]);
  const result=assessMcpServer(server,{sourceAuthority:'official'});
  assert.notEqual(result.status,'stable');
  assert.ok(['quarantined','candidate'].includes(result.status));
  assert.ok(result.permissions.includes('tool:render_design:write'));
});
