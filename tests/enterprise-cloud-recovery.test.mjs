import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { EnterpriseService } from '../src/enterprise/enterprise-service.mjs';
import { ScimService } from '../src/enterprise/scim-service.mjs';
import { OidcLoginManager } from '../src/enterprise/oidc-login-manager.mjs';
import { CloudQueue } from '../src/cloud/cloud-queue.mjs';
import { AutoscalingController } from '../src/cloud/autoscaling-controller.mjs';
import { CloudSandboxService } from '../src/cloud/cloud-sandbox-service.mjs';
import { OAuthResourceServer } from '../src/mcp/oauth-resource-server.mjs';
import { StreamableHttpSessionStore } from '../src/mcp/streamable-http-session.mjs';
import { RemoteMcpServer } from '../src/mcp/remote-mcp-server.mjs';
import { VERSION } from '../src/version.mjs';
import { PluginSigningService } from '../src/plugins/plugin-signing-service.mjs';
import { PluginTrustStore } from '../src/plugins/plugin-trust-store.mjs';
import { PluginTransparencyLog } from '../src/plugins/plugin-transparency-log.mjs';

const digest = `sha256:${'a'.repeat(64)}`;

test('enterprise authorization is tenant scoped, default deny, and explicit deny wins', () => {
  const service = new EnterpriseService();
  service.createOrganization({ id: 'org-a', name: 'A' });
  service.createOrganization({ id: 'org-b', name: 'B' });
  service.upsertMember({ organizationId: 'org-a', principalId: 'alice', roles: ['developer'] });
  service.bindPolicy({ id: 'allow-code', organizationId: 'org-a', effect: 'allow', roles: ['developer'], actions: ['code.*'], resources: ['repo:*'] });
  service.bindPolicy({ id: 'deny-prod', organizationId: 'org-a', effect: 'deny', roles: ['developer'], actions: ['code.deploy'], resources: ['repo:production'] });
  assert.equal(service.authorize({ organizationId: 'org-a', principalId: 'alice', action: 'code.read', resource: 'repo:app' }).decision, 'allow');
  assert.equal(service.authorize({ organizationId: 'org-a', principalId: 'alice', action: 'code.deploy', resource: 'repo:production' }).code, 'explicit-deny');
  assert.equal(service.authorize({ organizationId: 'org-b', principalId: 'alice', action: 'code.read', resource: 'repo:app' }).code, 'default-deny');
  assert.equal(service.listAuditEvents({ organizationId: 'org-a' }).length, 2);
});

test('cloud queue uses fencing tokens, retries, dead letters, and bounded autoscaling', () => {
  let now = 1_000;
  const queue = new CloudQueue({ clock: () => now, maxAttempts: 2 });
  queue.enqueue({ id: 'job-1', organizationId: 'org-a', workspaceId: 'ws-1', priority: 5, payload: { command: 'test' } });
  const first = queue.lease({ organizationId: 'org-a', workerId: 'worker-1', leaseMs: 100 });
  assert.equal(first.fencingToken, 1);
  assert.throws(() => queue.complete({ jobId: 'job-1', workerId: 'worker-1', fencingToken: 0 }), /fencing/i);
  queue.fail({ jobId: 'job-1', workerId: 'worker-1', fencingToken: 1, retryable: true, error: { code: 'transient' } });
  const second = queue.lease({ organizationId: 'org-a', workerId: 'worker-2', leaseMs: 100 });
  assert.equal(second.fencingToken, 2);
  assert.equal(queue.fail({ jobId: 'job-1', workerId: 'worker-2', fencingToken: 2, retryable: true }).state, 'dead-letter');
  const scale = new AutoscalingController({ clock: () => now }).decide({ activeWorkers: 1, queueDepth: 11 }, { minWorkers: 1, maxWorkers: 4, targetJobsPerWorker: 3 });
  assert.deepEqual(scale, { desiredWorkers: 4, currentWorkers: 1, queueDepth: 11, reason: 'queue-pressure', boundedBy: 'max' });
});

test('cloud sandbox enforces tenant, region, residency, digest, resource, TTL, and secret-reference boundaries', async () => {
  const calls = [];
  const driver = {
    async provision(spec) { calls.push(['provision', spec]); return { state: 'running', isolationLevel: 'microvm', providerId: `box-${spec.id}` }; },
    async snapshot(id) { calls.push(['snapshot', id]); return { snapshotId: `snap-${id}` }; },
    async terminate(id) { calls.push(['terminate', id]); },
  };
  const service = new CloudSandboxService({
    driver,
    policies: { 'org-a': { allowedRegions: ['ap-southeast-1'], dataResidency: 'VN', maxActive: 1, maxCpu: 4, maxRamMb: 4096, maxTtlMs: 60_000 } },
  });
  const box = await service.create({ organizationId: 'org-a', workspaceId: 'ws-1', region: 'ap-southeast-1', dataResidency: 'VN', imageDigest: digest, resources: { cpu: 2, ramMb: 2048 }, ttlMs: 30_000, network: { mode: 'allowlist', domains: ['registry.npmjs.org'] }, secrets: [{ ref: 'vault://org-a/npm' }] });
  assert.equal(box.isolationLevel, 'microvm');
  assert.deepEqual(box.secretRefs, ['vault://org-a/npm']);
  assert.equal(Object.hasOwn(box, 'driverState'), false);
  assert.throws(() => service.get({ organizationId: 'org-b', sandboxId: box.id }), /not found/i);
  await assert.rejects(() => service.create({ organizationId: 'org-a', workspaceId: 'ws-2', region: 'ap-southeast-1', dataResidency: 'VN', imageDigest: digest, resources: { cpu: 1, ramMb: 512 }, ttlMs: 10_000, network: { mode: 'deny' } }), (error) => error.code === 'sandbox-quota');
  assert.deepEqual(await service.snapshot({ organizationId: 'org-a', sandboxId: box.id }), { snapshotId: `snap-${box.id}` });
  assert.equal((await service.terminate({ organizationId: 'org-a', sandboxId: box.id })).state, 'terminated');
});

test('OAuth protected remote MCP is scope and tenant bound with resumable sessions', async () => {
  const nowSeconds = 2_000;
  const oauth = new OAuthResourceServer({ issuer: 'https://issuer.example', audience: 'forge-mcp', clock: () => nowSeconds * 1_000, verifier: async (token) => token === 'valid' ? { iss: 'https://issuer.example', aud: ['forge-mcp'], exp: nowSeconds + 60, scope: 'mcp.read mcp.invoke', sub: 'alice', organization_id: 'org-a', workspace_id: 'ws-1' } : null });
  const principal = await oauth.authenticate({ headers: { authorization: 'Bearer valid' } }, { scopes: ['mcp.invoke'], organizationId: 'org-a', workspaceId: 'ws-1' });
  assert.equal(principal.subject, 'alice');
  await assert.rejects(() => oauth.authenticate({ headers: { authorization: 'Bearer valid' } }, { scopes: ['admin'] }), (error) => error.code === 'oauth-scope');
  const sessions = new StreamableHttpSessionStore({ clock: () => nowSeconds * 1_000 });
  const server = new RemoteMcpServer({ sessions, gateway: { async listTools() { return [{ name: 'docs.search' }]; }, async callTool() { return { ok: true }; } } });
  const initialized = await server.handleMessage({ principal, message: { jsonrpc: '2.0', id: 1, method: 'initialize' } });
  assert.equal(initialized.response.result.serverInfo.version, VERSION);
  await server.handleMessage({ sessionId: initialized.sessionId, principal, message: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
  const events = sessions.read({ sessionId: initialized.sessionId, organizationId: 'org-a', workspaceId: 'ws-1', afterEventId: 1 });
  assert.equal(events[0].data.result.tools[0].name, 'docs.search');
  assert.throws(() => sessions.read({ sessionId: initialized.sessionId, organizationId: 'org-b', workspaceId: 'ws-1' }), /not found/i);
});

test('production plugin bundles are Ed25519 signed, scope checked, revocable, and transparency logged', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-plugin-signing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'plugin.json'), '{"name":"safe-plugin"}\n');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const signing = new PluginSigningService();
  const bundle = await signing.signDirectory({ directory: root, publisherId: 'publisher-1', keyId: 'key-1', privateKey });
  const trust = new PluginTrustStore({ signingService: signing });
  trust.addPublisher({ publisherId: 'publisher-1', keyId: 'key-1', publicKey, scopes: ['safe-plugin'] });
  const verified = await trust.evaluateBundle({ bundle, directory: root, pluginId: 'safe-plugin' });
  assert.equal(verified.trusted, true);
  const log = new PluginTransparencyLog();
  log.append({ publisherId: verified.publisherId, keyId: verified.keyId, pluginId: verified.pluginId, rootHash: verified.rootHash, action: 'publish' });
  assert.equal(log.verify().valid, true);
  trust.revokeKey({ publisherId: 'publisher-1', keyId: 'key-1', reason: 'compromised' });
  await assert.rejects(() => trust.evaluateBundle({ bundle, directory: root, pluginId: 'safe-plugin' }), /revoked/i);
});


test('SCIM users and groups remain tenant scoped and deactivate instead of silently disappearing', () => {
  const service = new ScimService({ clock: () => 1_700_000_000_000 });
  const alice = service.createUser('org-a', { id: 'alice', userName: 'alice@example.com', active: true, displayName: 'Alice' });
  service.createUser('org-b', { id: 'alice', userName: 'alice@example.com', active: true, displayName: 'Other Alice' });
  const group = service.createGroup('org-a', { id: 'devs', displayName: 'Developers', members: [{ value: alice.id }] });
  assert.equal(group.members[0].value, 'alice');
  assert.equal(service.listUsers('org-a').totalResults, 1);
  assert.equal(service.listUsers('org-b').totalResults, 1);
  assert.equal(service.deleteUser('org-a', 'alice').active, false);
  assert.equal(service.getUser('org-b', 'alice').active, true);
});

test('OIDC authorization code flow uses PKCE, nonce, one-time state, and bounded return targets', async () => {
  let tokenBody;
  let callback;
  const provider = {
    authorizationEndpoint: 'https://identity.example/authorize', tokenEndpoint: 'https://identity.example/token', clientId: 'forge-client', redirectUri: 'https://forge.example/callback', scopes: ['openid', 'profile'],
    oidcService: { async validateLoginCallback(input) { callback = input; return { subject: 'alice', organizationId: input.organizationId, groups: ['dev'] }; } },
  };
  const manager = new OidcLoginManager({
    providerResolver: (organizationId) => { assert.equal(organizationId, 'org-a'); return provider; },
    fetchImpl: async (_url, init) => { tokenBody = new URLSearchParams(init.body); return { ok: true, async json() { return { id_token: 'signed-id-token' }; } }; },
    clock: () => 1_000,
  });
  const start = manager.begin({ organizationId: 'org-a', returnTo: '/workspace' });
  const authorization = new URL(start.authorizationUrl);
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorization.searchParams.get('nonce'));
  const completed = await manager.complete({ state: start.state, code: 'authorization-code' });
  assert.equal(tokenBody.get('code_verifier').length >= 43, true);
  assert.equal(callback.expectedNonce, authorization.searchParams.get('nonce'));
  assert.equal(completed.returnTo, '/workspace');
  await assert.rejects(() => manager.complete({ state: start.state, code: 'replay' }), (error) => error.code === 'oidc-state-invalid');
});
