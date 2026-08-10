import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { A2aTaskStore } from '../src/server/a2a-task-store.mjs';
import { agentCard, handleA2aRpc } from '../src/server/a2a.mjs';

async function context(t, principalId = 'agent:a') {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-a2a-v1-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return {
    forge: new ForgeOrchestrator(new ProjectStore(path.join(dir, 'projects'))),
    taskStore: new A2aTaskStore(path.join(dir, 'tasks')),
    baseUrl: 'https://forge.example',
    principal: createPrincipal({ id: principalId, type: 'agent', roles: ['worker'], scopes: ['*'] }),
  };
}

function request(id, method, params) { return { jsonrpc: '2.0', id, method, params }; }
function createProjectMessage(name = 'A2A Product') {
  return {
    messageId: 'message-1', role: 'ROLE_USER',
    parts: [{ data: { action: 'project.create', input: { name, domain: 'saas', assurance: 'A1' } }, mediaType: 'application/json' }],
  };
}

test('A2A 1.0 Agent Card accurately declares supported interfaces', () => {
  const card = agentCard('https://forge.example');
  assert.equal(card.name, 'ForgeOS');
  assert.equal(card.supportedInterfaces[0].url, 'https://forge.example/a2a');
  assert.equal(card.supportedInterfaces[0].protocolBinding, 'JSONRPC');
  assert.equal(card.supportedInterfaces[0].protocolVersion, '1.0');
  assert.equal('protocolVersion' in card, false);
  assert.equal('preferredTransport' in card, false);
  assert.equal(card.capabilities.streaming, false);
  assert.equal(card.capabilities.pushNotifications, false);
});

test('A2A SendMessage accepts data-only parts, calls ForgeOS, and persists task history', async (t) => {
  const ctx = await context(t);
  const sent = await handleA2aRpc(request(1, 'SendMessage', { message: createProjectMessage() }), ctx);
  assert.equal(sent.result.task.status.state, 'TASK_STATE_COMPLETED');
  assert.equal(sent.result.task.history[0].role, 'ROLE_USER');
  assert.equal(sent.result.task.history[1].role, 'ROLE_AGENT');
  const data = sent.result.task.artifacts[0].parts[0].data;
  assert.ok(data.project.id);
  assert.equal((await ctx.forge.listProjects()).length, 1);
  const ownedProject=await ctx.forge.getProject(data.project.id,{principal:ctx.principal});
  assert.equal(ownedProject.access.ownerPrincipalId,ctx.principal.id);

  const fetched = await handleA2aRpc(request(2, 'GetTask', { id: sent.result.task.id, historyLength: 1 }), ctx);
  assert.equal(fetched.result.id, sent.result.task.id);
  assert.equal(fetched.result.history.length, 1);
  assert.equal(fetched.result.ownerPrincipalId, undefined);
});

test('A2A task visibility is scoped to authenticated principal', async (t) => {
  const owner = await context(t, 'agent:owner');
  const sent = await handleA2aRpc(request(1, 'SendMessage', { message: createProjectMessage('Private') }), owner);
  const stranger = { ...owner, principal: createPrincipal({ id: 'agent:stranger', type: 'agent', roles: ['worker'], scopes: ['*'] }) };
  const denied = await handleA2aRpc(request(2, 'GetTask', { id: sent.result.task.id }), stranger);
  assert.equal(denied.error.code, -32001);
  const list = await handleA2aRpc(request(3, 'ListTasks', { pageSize: 20 }), stranger);
  assert.equal(list.result.tasks.length, 0);
});

test('A2A validates part union and v1 method names', async (t) => {
  const ctx = await context(t);
  const invalid = await handleA2aRpc(request(1, 'SendMessage', { message: { messageId:'m', role:'ROLE_USER', parts:[{ text:'x', data:{} }] } }), ctx);
  assert.equal(invalid.error.code, -32602);
  const legacy = await handleA2aRpc(request(2, 'message/send', { message:createProjectMessage() }), ctx);
  assert.equal(legacy.error.code, -32601);
});

test('A2A CancelTask cancels non-terminal tasks and persists transition history', async (t) => {
  const ctx = await context(t);
  const sent = await handleA2aRpc(request(1, 'SendMessage', {
    message: { messageId:'defer-1', role:'ROLE_USER', parts:[{ data:{ action:'task.defer', input:{ reason:'external worker' } } }] },
  }), ctx);
  assert.equal(sent.result.task.status.state, 'TASK_STATE_SUBMITTED');
  const canceled = await handleA2aRpc(request(2, 'CancelTask', { id:sent.result.task.id }), ctx);
  assert.equal(canceled.result.status.state, 'TASK_STATE_CANCELED');
  assert.equal(canceled.result.statusHistory.at(-1).state, 'TASK_STATE_CANCELED');
});


test('A2A read-only project access cannot invoke mutating planning or gate actions', async (t) => {
  const ctx=await context(t,'agent:reader');
  const owner=createPrincipal({id:'human:a2a-owner',type:'human',roles:['owner'],scopes:['*'],trustDomain:'org:a2a'});
  const project=await ctx.forge.createProject({name:'Read-only A2A project',domain:'saas',assurance:'A1'},{principal:owner});
  await ctx.forge.grantProjectAccess(project.id,{principalId:ctx.principal.id,trustDomain:ctx.principal.trustDomain,capabilities:['read']},{principal:owner});
  const response=await handleA2aRpc(request(1,'SendMessage',{message:{messageId:'readonly-gate',role:'ROLE_USER',parts:[{data:{action:'project.gate.run',input:{projectId:project.id}},mediaType:'application/json'}]}}),ctx);
  assert.equal(response.result.task.status.state,'TASK_STATE_FAILED');
  const unchanged=await ctx.forge.getProject(project.id,{principal:owner});
  assert.equal(unchanged.gates.length,0);
});
