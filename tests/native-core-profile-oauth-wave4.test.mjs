import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProfileConfigurationRuntime } from '../src/native-core/profile-configuration-runtime.mjs';
import { OAuthSecurityRuntime } from '../src/native-core/oauth-security-runtime.mjs';

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-profile-wave4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const profiles = new ProfileConfigurationRuntime({ file: path.join(root, 'profiles.json'), clock: (() => { let n = 100; return () => ++n; })() });
  await profiles.open();
  const oauth = new OAuthSecurityRuntime({ clock: (() => { let n = 1000; return () => ++n; })(), ttlMs: 50 });
  return { root, profiles, oauth };
}

test('profile configuration persists scoped settings, versions and credential references without secrets', async (t) => {
  const { root, profiles } = await setup(t);
  const created = await profiles.createProfile({ id: 'alice', name: 'Alice', settings: { appearance: 'dark', provider: 'openai-main' } });
  assert.equal(created.version, 1);
  const updated = await profiles.updateProfile('alice', { expectedVersion: 1, settings: { fallbackModels: ['local'], keybindings: { run: 'Ctrl+Enter' }, maxTokens: 4096 }, credentialRefs: { provider: 'vault:openai' } });
  assert.equal(updated.version, 2);
  assert.equal(updated.settings.maxTokens, 4096);
  await assert.rejects(() => profiles.updateProfile('alice', { expectedVersion: 1, settings: {} }), /version conflict/i);
  await assert.rejects(() => profiles.updateProfile('alice', { expectedVersion: 2, credentialRefs: { provider: 'sk-secret' } }), /credential reference/i);
  const exported = profiles.exportProfile('alice');
  assert.equal(JSON.stringify(exported).includes('sk-secret'), false);
  const restarted = new ProfileConfigurationRuntime({ file: path.join(root, 'profiles.json') });
  await restarted.open();
  assert.equal(restarted.getProfile('alice').settings.appearance, 'dark');
  await restarted.renameProfile('alice', { name: 'Alice 2', expectedVersion: 2 });
  assert.equal(restarted.getProfile('alice').name, 'Alice 2');
  await restarted.deleteProfile('alice', { expectedVersion: 3 });
  assert.equal(restarted.getProfile('alice'), null);
});

test('OAuth security runtime enforces PKCE state, one-time callback, expiry and credential references', async (t) => {
  const { oauth } = await setup(t);
  const start = oauth.begin({ providerId: 'github', redirectUri: 'http://127.0.0.1:4567/callback', profileId: 'alice' });
  assert.match(start.state, /^[A-Za-z0-9_-]+$/);
  assert.match(start.codeChallenge, /^[A-Za-z0-9_-]+$/);
  await assert.rejects(() => oauth.complete({ state: 'wrong', code: 'abc', credentialRef: 'vault:github' }), /state/i);
  const done = await oauth.complete({ state: start.state, code: 'abc', codeVerifier: start.codeVerifier, credentialRef: 'vault:github' });
  assert.equal(done.providerId, 'github');
  assert.equal(JSON.stringify(done).includes('abc'), false);
  await assert.rejects(() => oauth.complete({ state: start.state, code: 'again', codeVerifier: start.codeVerifier, credentialRef: 'vault:github' }), /used|unknown/i);
  const revoked = oauth.revoke({ providerId: 'github', profileId: 'alice', credentialRef: 'vault:github' });
  assert.equal(revoked.revoked, true);
  const expiring = oauth.begin({ providerId: 'gitlab', redirectUri: 'http://127.0.0.1:4567/callback', profileId: 'alice', ttlMs: 0 });
  await assert.rejects(() => oauth.complete({ state: expiring.state, code: 'x', codeVerifier: expiring.codeVerifier, credentialRef: 'vault:gitlab' }), /expired/i);
});
