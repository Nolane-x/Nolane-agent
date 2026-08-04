import test from 'node:test';
import assert from 'node:assert/strict';
import { agentCard, handleA2aRpc } from '../src/server/a2a.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const principal = createPrincipal({ id:'agent-a2a', type:'agent', roles:['worker'], scopes:['*'] });

test('A2A 1.0 Agent Card exposes a v1 JSON-RPC interface without legacy URL fields', () => {
  const card = agentCard('https://forge.example');
  assert.equal(card.supportedInterfaces[0].protocolVersion, '1.0');
  assert.equal(card.supportedInterfaces[0].url, 'https://forge.example/a2a');
  assert.equal(card.supportedInterfaces[0].protocolBinding, 'JSONRPC');
  assert.equal('url' in card, false);
  assert.ok(card.skills.length >= 5);
});

test('A2A SendMessage invokes a real Forge action and returns a persisted completed task', async () => {
  const forge = { createProject: async (input) => ({ id:'forge_created', name:input.name }) };
  const response = await handleA2aRpc({ jsonrpc:'2.0', id:1, method:'SendMessage', params:{ message:{ messageId:'m1', role:'ROLE_USER', parts:[{ data:{ action:'project.create', input:{ name:'Demo' } } }] } } }, { baseUrl:'https://forge.example', principal, forge });
  assert.equal(response.result.task.status.state, 'TASK_STATE_COMPLETED');
  assert.equal(response.result.task.artifacts[0].parts[0].data.project.id, 'forge_created');
});

test('A2A returns method-not-found for unsupported v1 methods', async () => {
  const response = await handleA2aRpc({ jsonrpc:'2.0', id:1, method:'UnknownMethod', params:{} }, { principal });
  assert.equal(response.error.code, -32601);
});
