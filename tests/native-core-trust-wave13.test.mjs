import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  SecretProviderTckWave13,
  EnvironmentSecretProviderWave13,
  FileSecretProviderWave13,
  CommandSecretProviderWave13,
  TrustCoreRuntimeWave13,
} from '../src/native-core/trust-core-wave13.mjs';

async function temp(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave13-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }

test('secret provider TCK resolves by reference without exposing raw values', async (t) => {
  const root = await temp(t);
  const secretFile = path.join(root, 'provider-key');
  await writeFile(secretFile, 'file-secret\n', { mode: 0o600 });
  const envProvider = new EnvironmentSecretProviderWave13({ env: { NOLANE_TOKEN: 'env-secret' }, allow: ['NOLANE_TOKEN'] });
  const fileProvider = new FileSecretProviderWave13({ root, allow: ['provider-key'] });
  assert.equal(await envProvider.resolve({ ref: 'env:NOLANE_TOKEN' }), 'env-secret');
  assert.equal(await fileProvider.resolve({ ref: 'file:provider-key' }), 'file-secret');
  assert.equal(JSON.stringify(envProvider.snapshot()).includes('env-secret'), false);
  assert.equal((await new SecretProviderTckWave13().verify(envProvider, { ref: 'env:NOLANE_TOKEN' })).status, 'pass');
  await assert.rejects(() => envProvider.resolve({ ref: 'env:OTHER' }), (error) => error.code === 'SECRET_REFERENCE_DENIED');
});

test('command secret provider is allowlisted, timeout-bounded and redacted', async () => {
  const provider = new CommandSecretProviderWave13({ commands: { demo: [process.execPath, ['-e', "process.stdout.write('command-secret')"]] }, timeoutMs: 2_000 });
  assert.equal(await provider.resolve({ ref: 'command:demo' }), 'command-secret');
  await assert.rejects(() => provider.resolve({ ref: 'command:missing' }), (error) => error.code === 'SECRET_REFERENCE_DENIED');
  assert.equal(JSON.stringify(provider.snapshot()).includes('command-secret'), false);
});

test('OAuth registry enforces PKCE, redirect allowlist, one-time state and credential references', async (t) => {
  const root = await temp(t);
  const runtime = new TrustCoreRuntimeWave13({ file: path.join(root, 'trust.json'), redirectAllowlist: ['http://127.0.0.1:49152/callback'], clock: () => 1_000 });
  await runtime.open();
  runtime.oauth.registerProvider({ id: 'demo', authorizationUrl: 'https://auth.example/authorize', scopes: ['read'] });
  const begin = runtime.oauth.begin({ providerId: 'demo', profileId: 'p1', redirectUri: 'http://127.0.0.1:49152/callback' });
  assert.equal(begin.codeChallengeMethod, 'S256');
  const complete = await runtime.oauth.complete({ state: begin.state, code: 'authorization-code', codeVerifier: begin.codeVerifier, exchange: async () => ({ credentialRef: 'vault:demo-p1', expiresAt: 2_000 }) });
  assert.equal(complete.credentialRef, 'vault:demo-p1');
  assert.equal(JSON.stringify(runtime.snapshot()).includes('authorization-code'), false);
  await assert.rejects(() => runtime.oauth.complete({ state: begin.state, code: 'replay', codeVerifier: begin.codeVerifier, exchange: async () => ({ credentialRef: 'vault:x' }) }), (error) => error.code === 'OAUTH_STATE_INVALID');
  assert.throws(() => runtime.oauth.begin({ providerId: 'demo', profileId: 'p1', redirectUri: 'https://evil.example/callback' }), (error) => error.code === 'OAUTH_REDIRECT_DENIED');
});

test('revocation downgrades permissions and boot reauthentication is projected without secret material', async (t) => {
  const root = await temp(t);
  const runtime = new TrustCoreRuntimeWave13({ file: path.join(root, 'trust.json'), redirectAllowlist: ['http://127.0.0.1:49152/callback'] });
  await runtime.open();
  runtime.auth.grant({ profileId: 'p1', permissions: ['tool:read', 'tool:write'], credentialRef: 'vault:p1' });
  runtime.auth.requireReauthentication({ profileId: 'p1', reason: 'boot-token-expired' });
  assert.equal(runtime.auth.status('p1').reauthRequired, true);
  runtime.auth.revoke({ profileId: 'p1', reason: 'user-revoked' });
  assert.deepEqual(runtime.auth.status('p1').permissions, []);
  assert.equal(JSON.stringify(runtime.snapshot()).includes('vault:p1'), true);
});

test('gateway pairing is one-time, expiring, profile-scoped and revoke-safe', async (t) => {
  const root = await temp(t); let now = 1_000;
  const runtime = new TrustCoreRuntimeWave13({ file: path.join(root, 'trust.json'), redirectAllowlist: [], clock: () => now });
  await runtime.open();
  const invite = runtime.pairing.issue({ profileId: 'p1', permissions: ['message:send'], ttlMs: 100 });
  const enrolled = await runtime.pairing.enroll({ code: invite.code, deviceId: 'device-1' });
  assert.equal(enrolled.profileId, 'p1');
  await assert.rejects(() => runtime.pairing.enroll({ code: invite.code, deviceId: 'device-2' }), (error) => error.code === 'PAIRING_CODE_INVALID');
  const expiring = runtime.pairing.issue({ profileId: 'p1', permissions: [], ttlMs: 10 });
  now = 2_000;
  await assert.rejects(() => runtime.pairing.enroll({ code: expiring.code, deviceId: 'device-3' }), (error) => error.code === 'PAIRING_CODE_EXPIRED');
  runtime.pairing.revoke({ deviceId: 'device-1' });
  assert.equal(runtime.pairing.status('device-1').state, 'revoked');
});
