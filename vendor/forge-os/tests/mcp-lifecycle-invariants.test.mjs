import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createMcpSession, handleMcpRpc } from '../src/server/mcp.mjs';

async function makeContext(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-mcp-v2-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return {
    forge: new ForgeOrchestrator(new ProjectStore(dir)),
    baseUrl: 'https://forge.example',
    principal: createPrincipal({ id: 'agent:test', type: 'agent', roles: ['worker'], scopes: ['*'] }),
    session: createMcpSession(),
  };
}

async function initialize(context) {
  const initialized = await handleMcpRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } } }, context);
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  const notification = await handleMcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, context);
  assert.equal(notification, null);
}

test('MCP blocks operations before initialization and rejects unsupported versions', async (t) => {
  const context = await makeContext(t);
  const before = await handleMcpRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, context);
  assert.equal(before.error.code, -32002);
  assert.equal(before.error.data.code, 'session_not_initialized');

  const unsupported = await handleMcpRpc({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: '1900-01-01', capabilities: {}, clientInfo: { name: 'old', version: '1' } } }, context);
  assert.equal(unsupported.error.code, -32602);
  assert.deepEqual(unsupported.error.data.supported, ['2025-11-25']);
});

test('MCP lifecycle requires initialized notification before normal operations', async (t) => {
  const context = await makeContext(t);
  const initialized = await handleMcpRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1' } } }, context);
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  const premature = await handleMcpRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, context);
  assert.equal(premature.error.data.code, 'session_not_ready');
  await handleMcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, context);
  const ready = await handleMcpRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, context);
  assert.ok(ready.result.tools.length >= 20);
});

test('MCP notifications never receive JSON-RPC responses', async (t) => {
  const context = await makeContext(t);
  await initialize(context);
  assert.equal(await handleMcpRpc({ jsonrpc: '2.0', method: 'ping', params: {} }, context), null);
  assert.equal(await handleMcpRpc({ jsonrpc: '2.0', method: 'notifications/unknown', params: {} }, context), null);
});

test('MCP validates advertised input schemas and rejects additional properties', async (t) => {
  const context = await makeContext(t);
  await initialize(context);
  const invalid = await handleMcpRpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'forge_project_create', arguments: { name: 'Demo', domain: 'saas', assurance: 'A1', injected: true } } }, context);
  assert.equal(invalid.result.isError, true);
  assert.equal(invalid.result.structuredContent.error.code, 'invalid_tool_arguments');
  assert.match(invalid.result.content[0].text, /Invalid arguments/);
});

test('MCP public errors are stable and do not leak internal paths or causes', async (t) => {
  const context = await makeContext(t);
  await initialize(context);
  const result = await handleMcpRpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'forge_project_get', arguments: { projectId: 'forge_missing' } } }, context);
  assert.equal(result.result.isError, true);
  assert.equal(result.result.structuredContent.error.code, 'tool_execution_error');
  assert.ok(result.result.structuredContent.error.requestId);
  assert.doesNotMatch(JSON.stringify(result), /\/tmp\/|ENOENT|project-store\.mjs/);
});

test('MCP selected skills can be fetched without loading every skill body', async (t) => {
  const context = await makeContext(t);
  await initialize(context);
  const result = await handleMcpRpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'forge_skill_get', arguments: { name: 'resolving-user-intent' } } }, context);
  assert.equal(result.result.structuredContent.skill.name, 'resolving-user-intent');
  assert.match(result.result.structuredContent.skill.body, /Resolving User Intent/i);
});
