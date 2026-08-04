import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { atomicWriteJson, readJson, sha256 } from './native-runtime-utils.mjs';

const error = (code, message) => Object.assign(new Error(message), { code });
const clone = (value) => structuredClone(value);
const base64url = (buffer) => Buffer.from(buffer).toString('base64url');
const challenge = (verifier) => base64url(createHash('sha256').update(verifier).digest());
const parseRef = (ref, scheme) => {
  const text = String(ref ?? '');
  const prefix = `${scheme}:`;
  if (!text.startsWith(prefix) || text.length === prefix.length) throw error('SECRET_REFERENCE_INVALID', `Expected ${scheme}: reference`);
  return text.slice(prefix.length);
};
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

export class EnvironmentSecretProviderWave13 {
  constructor({ env = process.env, allow = [] } = {}) { this.env = env; this.allow = new Set(allow.map(String)); this.accesses = 0; }
  async resolve({ ref } = {}) { const name = parseRef(ref, 'env'); if (!this.allow.has(name) || this.env[name] === undefined) throw error('SECRET_REFERENCE_DENIED', `Environment secret ${name} is not allowed`); this.accesses += 1; return String(this.env[name]); }
  snapshot() { return { schema: 'nolane.secret-provider.env.v1', allowed: [...this.allow].sort(), accesses: this.accesses }; }
}

export class FileSecretProviderWave13 {
  constructor({ root, allow = [] } = {}) { if (!root) throw new TypeError('root is required'); this.root = path.resolve(root); this.allow = new Set(allow.map((entry) => String(entry).replaceAll('\\', '/'))); this.accesses = 0; }
  async resolve({ ref } = {}) {
    const relative = parseRef(ref, 'file').replaceAll('\\', '/');
    if (!this.allow.has(relative)) throw error('SECRET_REFERENCE_DENIED', `File secret ${relative} is not allowed`);
    const target = path.resolve(this.root, relative);
    if (!inside(this.root, target)) throw error('SECRET_REFERENCE_DENIED', 'File secret escaped configured root');
    const info = await stat(target);
    if (!info.isFile() || (info.mode & 0o077) !== 0) throw error('SECRET_FILE_PERMISSIONS', 'Secret file must be a private regular file');
    this.accesses += 1;
    return (await readFile(target, 'utf8')).trimEnd();
  }
  snapshot() { return { schema: 'nolane.secret-provider.file.v1', rootSha256: sha256(this.root), allowed: [...this.allow].sort(), accesses: this.accesses }; }
}

export class CommandSecretProviderWave13 {
  constructor({ commands = {}, timeoutMs = 5_000, maxOutputBytes = 64 * 1024 } = {}) { this.commands = new Map(Object.entries(commands)); this.timeoutMs = timeoutMs; this.maxOutputBytes = maxOutputBytes; this.accesses = 0; }
  async resolve({ ref } = {}) {
    const id = parseRef(ref, 'command'); const command = this.commands.get(id);
    if (!command) throw error('SECRET_REFERENCE_DENIED', `Command secret ${id} is not allowed`);
    const [file, args = []] = command;
    const output = await new Promise((resolve, reject) => {
      const child = spawn(file, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {} });
      const chunks = []; let size = 0; let stderr = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(error('SECRET_COMMAND_TIMEOUT', `Secret command ${id} timed out`)); }, this.timeoutMs);
      child.stdout.on('data', (chunk) => { size += chunk.length; if (size > this.maxOutputBytes) { child.kill('SIGKILL'); reject(error('SECRET_COMMAND_OUTPUT_LIMIT', 'Secret command output exceeded limit')); } else chunks.push(chunk); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8').slice(0, 1_024); });
      child.once('error', (cause) => { clearTimeout(timer); reject(cause); });
      child.once('exit', (code) => { clearTimeout(timer); if (code !== 0) reject(error('SECRET_COMMAND_FAILED', `Secret command failed with exit ${code}: ${stderr}`)); else resolve(Buffer.concat(chunks).toString('utf8').trimEnd()); });
    });
    this.accesses += 1; return output;
  }
  snapshot() { return { schema: 'nolane.secret-provider.command.v1', commands: [...this.commands.keys()].sort(), accesses: this.accesses, timeoutMs: this.timeoutMs, maxOutputBytes: this.maxOutputBytes }; }
}

export class SecretProviderTckWave13 {
  async verify(provider, input) {
    try {
      const value = await provider.resolve(input);
      if (typeof value !== 'string' || value.length === 0) throw new Error('resolved value must be a non-empty string');
      const snapshot = provider.snapshot();
      if (JSON.stringify(snapshot).includes(value)) throw new Error('provider snapshot leaked secret material');
      return { status: 'pass', provider: provider.constructor.name, referenceSha256: sha256(input.ref) };
    } catch (cause) { return { status: 'fail', provider: provider?.constructor?.name ?? 'unknown', error: cause.message }; }
  }
}

class OAuthProviderRegistryWave13 {
  constructor({ state, persist, redirectAllowlist, clock }) { this.state = state; this.persist = persist; this.redirectAllowlist = new Set(redirectAllowlist); this.clock = clock; this.providers = new Map(); }
  registerProvider(provider = {}) { if (!provider.id || !provider.authorizationUrl) throw new TypeError('provider id and authorizationUrl are required'); this.providers.set(String(provider.id), { id: String(provider.id), authorizationUrl: String(provider.authorizationUrl), scopes: [...(provider.scopes ?? [])].map(String) }); return this.providers.get(String(provider.id)); }
  begin({ providerId, profileId, redirectUri } = {}) {
    const provider = this.providers.get(String(providerId)); if (!provider) throw error('OAUTH_PROVIDER_UNKNOWN', `Unknown OAuth provider ${providerId}`);
    if (!this.redirectAllowlist.has(String(redirectUri))) throw error('OAUTH_REDIRECT_DENIED', 'OAuth redirect URI is not allowed');
    const state = base64url(randomBytes(24)); const nonce = base64url(randomBytes(24)); const codeVerifier = base64url(randomBytes(32));
    this.state.oauthPending[state] = { providerId: provider.id, profileId: String(profileId), redirectUri: String(redirectUri), nonceSha256: sha256(nonce), verifierSha256: sha256(codeVerifier), expiresAt: Number(this.clock()) + 10 * 60_000 };
    void this.persist().catch(() => {});
    const url = new URL(provider.authorizationUrl); url.searchParams.set('state', state); url.searchParams.set('nonce', nonce); url.searchParams.set('redirect_uri', String(redirectUri)); url.searchParams.set('code_challenge', challenge(codeVerifier)); url.searchParams.set('code_challenge_method', 'S256'); if (provider.scopes.length) url.searchParams.set('scope', provider.scopes.join(' '));
    return { providerId: provider.id, profileId: String(profileId), state, nonce, codeVerifier, codeChallenge: challenge(codeVerifier), codeChallengeMethod: 'S256', authorizationUrl: url.toString() };
  }
  async complete({ state, code, codeVerifier, exchange } = {}) {
    const pending = this.state.oauthPending[String(state)];
    if (!pending || pending.expiresAt < Number(this.clock())) throw error('OAUTH_STATE_INVALID', 'OAuth state is missing, expired or already consumed');
    if (pending.verifierSha256 !== sha256(String(codeVerifier))) throw error('OAUTH_PKCE_INVALID', 'OAuth PKCE verifier is invalid');
    delete this.state.oauthPending[String(state)]; await this.persist();
    if (typeof exchange !== 'function') throw new TypeError('exchange is required');
    const exchanged = await exchange({ providerId: pending.providerId, profileId: pending.profileId, redirectUri: pending.redirectUri, code: String(code), codeVerifier: String(codeVerifier) });
    if (!exchanged?.credentialRef || !/^[a-z][a-z0-9+.-]*:/i.test(exchanged.credentialRef)) throw error('OAUTH_CREDENTIAL_REFERENCE_REQUIRED', 'OAuth exchange must return a credential reference');
    const key = `${pending.profileId}:${pending.providerId}`;
    this.state.oauthCredentials[key] = { providerId: pending.providerId, profileId: pending.profileId, credentialRef: String(exchanged.credentialRef), expiresAt: exchanged.expiresAt ?? null, revokedAt: null };
    await this.persist(); return clone(this.state.oauthCredentials[key]);
  }
  async refresh({ providerId, profileId, refresh } = {}) { const key = `${profileId}:${providerId}`; const current = this.state.oauthCredentials[key]; if (!current || current.revokedAt) throw error('OAUTH_CREDENTIAL_UNAVAILABLE', 'OAuth credential reference is unavailable'); const next = await refresh(clone(current)); if (!next?.credentialRef) throw error('OAUTH_CREDENTIAL_REFERENCE_REQUIRED', 'Refresh must return a credential reference'); this.state.oauthCredentials[key] = { ...current, credentialRef: String(next.credentialRef), expiresAt: next.expiresAt ?? current.expiresAt }; await this.persist(); return clone(this.state.oauthCredentials[key]); }
  async revoke({ providerId, profileId, reason = 'revoked' } = {}) { const key = `${profileId}:${providerId}`; const current = this.state.oauthCredentials[key]; if (!current) return { revoked: false }; current.revokedAt = Number(this.clock()); current.reason = String(reason); await this.persist(); return { revoked: true, providerId: String(providerId), profileId: String(profileId) }; }
  snapshot() { return { providers: [...this.providers.values()].map(clone), pending: Object.keys(this.state.oauthPending).length, credentials: Object.values(this.state.oauthCredentials).map(clone) }; }
}

class AuthenticationStateWave13 {
  constructor({ state, persist, clock }) { this.state = state; this.persist = persist; this.clock = clock; }
  grant({ profileId, permissions = [], credentialRef } = {}) { if (!profileId || !credentialRef) throw new TypeError('profileId and credentialRef are required'); const record = { profileId: String(profileId), permissions: [...new Set(permissions.map(String))].sort(), credentialRef: String(credentialRef), reauthRequired: false, reason: null, updatedAt: Number(this.clock()) }; this.state.authProfiles[record.profileId] = record; void this.persist().catch(() => {}); return clone(record); }
  requireReauthentication({ profileId, reason } = {}) { const record = this.state.authProfiles[String(profileId)] ?? { profileId: String(profileId), permissions: [], credentialRef: null }; record.reauthRequired = true; record.reason = String(reason ?? 'reauthentication-required'); record.updatedAt = Number(this.clock()); this.state.authProfiles[record.profileId] = record; void this.persist().catch(() => {}); return clone(record); }
  revoke({ profileId, reason = 'revoked' } = {}) { const record = this.state.authProfiles[String(profileId)] ?? { profileId: String(profileId), credentialRef: null }; record.permissions = []; record.reauthRequired = true; record.reason = String(reason); record.revokedAt = Number(this.clock()); record.updatedAt = Number(this.clock()); this.state.authProfiles[record.profileId] = record; void this.persist().catch(() => {}); return clone(record); }
  status(profileId) { return clone(this.state.authProfiles[String(profileId)] ?? { profileId: String(profileId), permissions: [], credentialRef: null, reauthRequired: true, reason: 'not-authenticated' }); }
  snapshot() { return Object.values(this.state.authProfiles).sort((a, b) => a.profileId.localeCompare(b.profileId)).map(clone); }
}

class PairingRegistryWave13 {
  constructor({ state, persist, clock }) { this.state = state; this.persist = persist; this.clock = clock; }
  issue({ profileId, permissions = [], ttlMs = 5 * 60_000 } = {}) { if (!profileId) throw new TypeError('profileId is required'); const code = base64url(randomBytes(18)); const codeSha256 = sha256(code); this.state.pairingInvites[codeSha256] = { codeSha256, profileId: String(profileId), permissions: [...new Set(permissions.map(String))].sort(), expiresAt: Number(this.clock()) + Number(ttlMs), usedAt: null }; void this.persist().catch(() => {}); return { code, profileId: String(profileId), expiresAt: this.state.pairingInvites[codeSha256].expiresAt }; }
  async enroll({ code, deviceId } = {}) { if (!deviceId) throw new TypeError('deviceId is required'); const codeSha256 = sha256(String(code)); const invite = this.state.pairingInvites[codeSha256]; if (!invite || invite.usedAt !== null) throw error('PAIRING_CODE_INVALID', 'Pairing code is invalid or already used'); if (invite.expiresAt < Number(this.clock())) { delete this.state.pairingInvites[codeSha256]; await this.persist(); throw error('PAIRING_CODE_EXPIRED', 'Pairing code expired'); } invite.usedAt = Number(this.clock()); const record = { deviceId: String(deviceId), profileId: invite.profileId, permissions: invite.permissions, state: 'active', enrolledAt: Number(this.clock()), revokedAt: null }; this.state.pairedDevices[record.deviceId] = record; await this.persist(); return clone(record); }
  revoke({ deviceId } = {}) { const record = this.state.pairedDevices[String(deviceId)]; if (!record) return { revoked: false }; record.state = 'revoked'; record.permissions = []; record.revokedAt = Number(this.clock()); void this.persist().catch(() => {}); return { revoked: true, deviceId: String(deviceId) }; }
  status(deviceId) { const record = this.state.pairedDevices[String(deviceId)]; if (!record) throw error('PAIRING_DEVICE_UNKNOWN', `Unknown paired device ${deviceId}`); return clone(record); }
  snapshot() { return { pending: Object.values(this.state.pairingInvites).filter((entry) => entry.usedAt === null && entry.expiresAt >= Number(this.clock())).length, devices: Object.values(this.state.pairedDevices).sort((a, b) => a.deviceId.localeCompare(b.deviceId)).map(clone) }; }
}

export class TrustCoreRuntimeWave13 {
  constructor({ file, redirectAllowlist = [], clock = () => Date.now() } = {}) { if (!file) throw new TypeError('file is required'); this.file = path.resolve(file); this.clock = clock; this.state = { schema: 'nolane.trust-core.wave13.v1', oauthPending: {}, oauthCredentials: {}, authProfiles: {}, pairingInvites: {}, pairedDevices: {} }; const persist = () => { const snapshot = clone(this.state); mkdirSync(path.dirname(this.file), { recursive: true }); const temp = `${this.file}.${process.pid}.${randomUUID()}.tmp`; writeFileSync(temp, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 }); renameSync(temp, this.file); return Promise.resolve(); }; this.oauth = new OAuthProviderRegistryWave13({ state: this.state, persist, redirectAllowlist, clock }); this.auth = new AuthenticationStateWave13({ state: this.state, persist, clock }); this.pairing = new PairingRegistryWave13({ state: this.state, persist, clock }); this.persist = persist; }
  async open() { const stored = await readJson(this.file, null); if (stored) { if (stored.schema !== 'nolane.trust-core.wave13.v1') throw error('TRUST_STORE_INVALID', 'Trust store schema is invalid'); Object.assign(this.state, stored); } return this.snapshot(); }
  snapshot() { const snapshot = { schema: this.state.schema, oauth: this.oauth.snapshot(), authentication: this.auth.snapshot(), pairing: this.pairing.snapshot() }; return { ...snapshot, receiptSha256: sha256(JSON.stringify(snapshot)) }; }
}
