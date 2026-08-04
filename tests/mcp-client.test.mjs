import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StdioMcpClient } from '../src/mcp/stdio-mcp-client.mjs';
import { McpRegistry } from '../src/mcp/mcp-registry.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(root, 'fixtures', 'mcp-server.mjs');

function client(overrides = {}) {
  return new StdioMcpClient({ id: 'fixture', label: 'Fixture MCP', executable: process.execPath, args: [fixture], env: { SECRET_TOKEN: 'hidden' }, timeoutMs: 1_000, ...overrides });
}

test('StdioMcpClient handshakes, caches deterministic tools, calls tools, and hides secrets', async (t) => {
  const mcp = client();
  t.after(() => mcp.close());
  const initialized = await mcp.connect();
  assert.equal(initialized.serverInfo.name, 'fixture');
  const tools1 = await mcp.listTools();
  const tools2 = await mcp.listTools();
  assert.equal(tools1, tools2);
  assert.deepEqual(tools1.map((tool) => tool.name), ['echo', 'slow']);
  const result = await mcp.callTool('echo', { text: 'hello' });
  assert.equal(result.structuredContent.echoed, 'hello');
  assert.doesNotMatch(JSON.stringify(mcp.publicView()), /hidden/);
});

test('StdioMcpClient surfaces JSON-RPC errors, times out, cancels, and cleans up', async () => {
  const mcp = client({ timeoutMs: 1_000 });
  await mcp.connect();
  await assert.rejects(() => mcp.request('tools/call', { name: 'error', arguments: {} }), /fixture error/);
  await assert.rejects(() => mcp.callTool('slow', {}, { timeoutMs: 100 }), /timed out/i);
  await mcp.close();
  assert.equal(mcp.state, 'closed');

  const cancelled = client({ timeoutMs: 2_000 });
  await cancelled.connect();
  const controller = new AbortController();
  const pending = cancelled.callTool('slow', {}, { signal: controller.signal });
  controller.abort('stop');
  await assert.rejects(() => pending, /cancelled/i);
  await cancelled.close();
});

test('McpRegistry exposes namespaced tools and rejects duplicates', async (t) => {
  const registry = new McpRegistry();
  const mcp = client();
  t.after(() => registry.close());
  registry.register(mcp);
  assert.throws(() => registry.register(client()), /duplicate/i);
  const tools = await registry.listTools();
  assert.deepEqual(tools.map((item) => item.name), ['fixture__echo', 'fixture__slow']);
  const result = await registry.callTool('fixture__echo', { text: 'registry' });
  assert.equal(result.structuredContent.echoed, 'registry');
});
