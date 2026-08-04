import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave4-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: root, workspaceRoot: root, clock: (() => { let n = 100; return () => ++n; })() });
  await service.open();
  return service;
}

test('orchestration production-wires agent, session, tool, profile and OAuth wave4 runtimes', async (t) => {
  const service = await fixture(t);
  const message = service.normalizeNativeMessage({ id: 'm1', role: 'assistant', content: 'ok <think>hide</think>' });
  assert.equal(message.content, 'ok ');
  await service.createSession({ id: 's1', title: 'Session', projectId: 'p1', profileId: 'alice' });
  await service.appendSessionMessage('s1', { id: 'u1', role: 'user', text: 'find retry' }, { profileId: 'alice' });
  await service.updateNativeSessionMetadata('s1', { profileId: 'alice', pinned: true, expectedVersion: 0 });
  assert.equal(service.listNativeSessions({ profileId: 'alice', pinned: true }).length, 1);
  assert.equal(service.governNativeToolSchema({ type: 'object', properties: { q: { type: 'string', examples: ['x'] } } }).properties.q.examples, undefined);
  const profile = await service.createNativeProfile({ id: 'alice', name: 'Alice', settings: { appearance: 'dark' } });
  assert.equal(profile.version, 1);
  const oauth = service.beginNativeOAuth({ providerId: 'github', profileId: 'alice', redirectUri: 'http://127.0.0.1:4567/callback' });
  const completed = await service.completeNativeOAuth({ state: oauth.state, code: 'code', codeVerifier: oauth.codeVerifier, credentialRef: 'vault:github' });
  assert.equal(completed.credentialRef, 'vault:github');
  const status = service.status().runtimeWave4;
  assert.equal(status.sessions.metadata, 1);
  assert.equal(status.profiles.profiles, 1);
  assert.equal(status.oauth.activeCredentialReferences, 1);
});

test('authenticated HTTP routes expose bounded wave4 operations without raw secrets', async (t) => {
  const nativeOrchestration = await fixture(t);
  const route = createRoutes({ nativeOrchestration });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    const handled = await route(req, res, new URL(`http://local${pathname}`));
    return { handled, status, body: data ? JSON.parse(data) : null };
  };
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/agent/normalize', body: { id: 'm1', role: 'assistant', content: 'done <think>x</think>' } })).body.content, 'done ');
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/profiles', body: { id: 'alice', name: 'Alice', settings: { appearance: 'dark' } } })).status, 201);
  const started = await call({ method: 'POST', pathname: '/api/nolane/native-core/oauth/begin', body: { providerId: 'github', profileId: 'alice', redirectUri: 'http://127.0.0.1:4567/callback' } });
  assert.equal(started.status, 201);
  const completed = await call({ method: 'POST', pathname: '/api/nolane/native-core/oauth/complete', body: { state: started.body.state, code: 'abc', codeVerifier: started.body.codeVerifier, credentialRef: 'vault:github' } });
  assert.equal(completed.status, 200);
  assert.equal(JSON.stringify(completed.body).includes('abc'), false);
  await nativeOrchestration.createSession({ id: 's1', title: 'Session', projectId: 'p1', profileId: 'alice' });
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/sessions/metadata', body: { sessionId: 's1', profileId: 'alice', pinned: true, expectedVersion: 0 } })).status, 200);
  assert.equal((await call({ pathname: '/api/nolane/native-core/sessions?profileId=alice&pinned=true' })).body.length, 1);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/tools/url', body: { url: 'https://example.com' } })).body.allowed, true);
});
