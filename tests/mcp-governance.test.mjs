import test from 'node:test';
import assert from 'node:assert/strict';

import { McpToolGateway } from '../src/mcp/mcp-tool-gateway.mjs';

function fixture() {
  const calls = [];
  const registry = {
    async listTools() {
      return [
        { name: 'docs__search', description: 'Search documentation', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
        { name: 'deploy__release', description: 'Deploy production', inputSchema: { type: 'object' } },
      ];
    },
    async callTool(name, args) { calls.push([name, args]); return { structuredContent: { ok: true, token: 'secret-value' } }; },
  };
  return { calls, gateway: new McpToolGateway({ registry }) };
}

test('McpToolGateway exposes only task-allowlisted schemas in OpenAI tool format', async () => {
  const f = fixture();
  const task = { id: 't', metadata: { mcpAllowedTools: ['docs__search'] } };
  const schemas = await f.gateway.schemasForTask(task);
  assert.deepEqual(schemas.map((item) => item.function.name), ['docs__search']);
  assert.equal(schemas[0].type, 'function');
  assert.equal(schemas[0].function.parameters.properties.q.type, 'string');
});

test('McpToolGateway denies undeclared MCP tools and emits a redacted content-addressed receipt', async () => {
  const f = fixture();
  const task = { id: 't', projectId: 'p', missionId: 'm', metadata: { mcpAllowedTools: ['docs__search'] } };
  await assert.rejects(() => f.gateway.execute(task, 'deploy__release', {}, {}), /not allowlisted/i);
  const result = await f.gateway.execute(task, 'docs__search', { q: 'context' }, { secretValues: ['secret-value'] });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.structuredContent.token, '[REDACTED]');
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(f.calls, [['docs__search', { q: 'context' }]]);
});

test('McpToolGateway defaults to no model-visible MCP capability', async () => {
  const f = fixture();
  assert.deepEqual(await f.gateway.schemasForTask({ id: 't', metadata: {} }), []);
  await assert.rejects(() => f.gateway.execute({ id: 't', metadata: {} }, 'docs__search', {}, {}), /not allowlisted/i);
});
