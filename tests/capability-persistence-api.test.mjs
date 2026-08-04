import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { CapabilityGrantLedger } from '../src/security/capability-registry.mjs';
import { SqliteCapabilityStore } from '../src/security/sqlite-capability-store.mjs';
import { createRoutes } from '../src/server/routes.mjs';

function response() {
  return { statusCode: null, body: '', writeHead(status) { this.statusCode = status; }, end(body = '') { this.body = String(body); } };
}
function request(method, body = null, principal = { subject: 'admin-1' }) {
  const req = new EventEmitter(); req.method = method; req.headers = {}; req.forgePrincipal = principal;
  req[Symbol.asyncIterator] = async function* iterator() { if (body !== null) yield Buffer.from(JSON.stringify(body)); };
  return req;
}

test('SqliteCapabilityStore preserves grants, audit, and consumed one-time state across restart', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-capabilities-'));
  const file = path.join(dir, 'capabilities.db');
  const firstStore = new SqliteCapabilityStore(file);
  const first = new CapabilityGrantLedger({ storage: firstStore });
  const grant = first.grant({ principalId: 'agent-1', capabilities: ['secret.read'], effect: 'allow', mode: 'once', scope: { tools: ['vault'] }, reason: 'One approved retrieval.', expectedImpact: 'Read one secret.', approvedBy: 'admin-1' });
  assert.equal(first.authorize({ principalId: 'agent-1', capability: 'secret.read', resource: { tool: 'vault' }, consume: true }).decision, 'allow');
  firstStore.close();

  const secondStore = new SqliteCapabilityStore(file);
  const second = new CapabilityGrantLedger({ storage: secondStore });
  assert.equal(second.getGrant(grant.id).usesRemaining, 0);
  assert.equal(second.authorize({ principalId: 'agent-1', capability: 'secret.read', resource: { tool: 'vault' }, consume: true }).decision, 'deny');
  assert.ok(second.auditEvents().some((event) => event.type === 'capability.authorization'));
  secondStore.close();
});

test('capability HTTP API lists definitions and binds approval identity to authenticated principal', async () => {
  const ledger = new CapabilityGrantLedger();
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, capabilityLedger: ledger });
  let res = response();
  await routes(request('GET'), res, new URL('/api/capabilities', 'http://localhost'));
  assert.equal(res.statusCode, 200);
  assert.ok(JSON.parse(res.body).some((item) => item.id === 'secret.read'));

  res = response();
  await routes(request('POST', { principalId: 'agent-1', capabilities: ['secret.read'], effect: 'allow', mode: 'session', sessionId: 's1', scope: { tools: ['vault'] }, reason: 'Approve the task.', expectedImpact: 'One session may read Vault.', approvedBy: 'forged-value' }, { subject: 'real-admin' }), res, new URL('/api/capability-grants', 'http://localhost'));
  assert.equal(res.statusCode, 201);
  const created = JSON.parse(res.body);
  assert.equal(created.approvedBy, 'real-admin');

  res = response();
  await routes(request('GET'), res, new URL('/api/capability-grants?principalId=agent-1', 'http://localhost'));
  assert.equal(JSON.parse(res.body).length, 1);

  res = response();
  await routes(request('DELETE', { reason: 'Task ended.' }, { subject: 'real-admin' }), res, new URL(`/api/capability-grants/${created.id}`, 'http://localhost'));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).revokedBy, 'real-admin');
});

test('capability HTTP API rejects anonymous approval identity and supports safe amendments', async () => {
  const ledger = new CapabilityGrantLedger();
  const created = ledger.grant({ principalId: 'agent-1', capabilities: ['network.use'], effect: 'allow', mode: 'persistent', scope: { domains: ['api.example.com'] }, reason: 'Initial scope.', expectedImpact: 'API access.', approvedBy: 'admin-1' });
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, capabilityLedger: ledger });
  const anonymous = response();
  await assert.rejects(() => routes(request('POST', {}, null), anonymous, new URL('/api/capability-grants', 'http://localhost')), /authenticated principal/i);
  const amendedRes = response();
  await routes(request('PATCH', { scope: { domains: ['v2.api.example.com'] }, reason: 'Narrow scope.', expectedImpact: 'Only v2 endpoint.' }, { subject: 'security-admin' }), amendedRes, new URL(`/api/capability-grants/${created.id}`, 'http://localhost'));
  assert.equal(amendedRes.statusCode, 200);
  const amended = JSON.parse(amendedRes.body);
  assert.deepEqual(amended.scope.domains, ['v2.api.example.com']);
  assert.equal(amended.approvedBy, 'security-admin');
});
