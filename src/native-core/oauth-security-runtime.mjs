import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const b64url = (value) => Buffer.from(value).toString('base64url');
const sha256b64 = (value) => createHash('sha256').update(value).digest('base64url');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const CREDENTIAL_REF = /^(vault|env|keychain|credential|secret):[A-Za-z0-9._:@/-]+$/;

function validateRedirect(value) {
  const url = new URL(String(value));
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('OAuth redirect must be HTTPS or loopback HTTP');
  if (url.username || url.password || url.hash) throw new Error('OAuth redirect contains forbidden components');
  return url.toString();
}

export class OAuthSecurityRuntime {
  constructor({ clock = () => Date.now(), ttlMs = 10 * 60_000 } = {}) { this.clock = clock; this.ttlMs = ttlMs; this.pending = new Map(); this.credentials = new Map(); this.revocations = []; }
  begin({ providerId, redirectUri, profileId = 'default', scopes = [], ttlMs = this.ttlMs } = {}) {
    if (!providerId || !profileId) throw new Error('providerId and profileId are required');
    const state = b64url(randomBytes(24)); const codeVerifier = b64url(randomBytes(32)); const codeChallenge = sha256b64(codeVerifier); const createdAt = this.clock();
    const record = { providerId: String(providerId), profileId: String(profileId), redirectUri: validateRedirect(redirectUri), scopes: [...new Set(scopes.map(String))].sort(), state, codeChallenge, createdAt, expiresAt: createdAt + Math.max(0, Number(ttlMs)), used: false };
    this.pending.set(state, record);
    return Object.freeze({ schema: 'nolane.agent.oauth-start.v1', providerId: record.providerId, profileId: record.profileId, redirectUri: record.redirectUri, scopes: record.scopes, state, codeVerifier, codeChallenge, expiresAt: record.expiresAt, receiptSha256: sha256(JSON.stringify(record)) });
  }
  async complete({ state, code, codeVerifier, credentialRef } = {}) {
    const record = this.pending.get(String(state));
    if (!record) throw new Error('OAuth state is unknown or already used');
    if (record.used) throw new Error('OAuth state already used');
    if (this.clock() > record.expiresAt) { this.pending.delete(String(state)); throw new Error('OAuth state expired'); }
    if (!code) throw new Error('OAuth authorization code is required');
    if (!CREDENTIAL_REF.test(String(credentialRef))) throw new Error('OAuth credential reference is invalid');
    const expected = Buffer.from(record.codeChallenge); const actual = Buffer.from(sha256b64(String(codeVerifier ?? '')));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('OAuth PKCE verifier mismatch');
    record.used = true; this.pending.delete(String(state));
    const key = `${record.profileId}:${record.providerId}`; this.credentials.set(key, String(credentialRef));
    const receipt = { schema: 'nolane.agent.oauth-completion.v1', providerId: record.providerId, profileId: record.profileId, credentialRef: String(credentialRef), scopes: record.scopes, completedAt: this.clock(), codeSha256: sha256(String(code)) };
    receipt.receiptSha256 = sha256(JSON.stringify(receipt));
    return Object.freeze(receipt);
  }
  revoke({ providerId, profileId = 'default', credentialRef } = {}) {
    const key = `${profileId}:${providerId}`; const stored = this.credentials.get(key);
    if (stored && credentialRef && stored !== credentialRef) throw new Error('credential reference mismatch');
    this.credentials.delete(key);
    const receipt = { schema: 'nolane.agent.oauth-revocation.v1', providerId: String(providerId), profileId: String(profileId), credentialRef: stored ?? String(credentialRef ?? ''), revoked: true, revokedAt: this.clock() };
    receipt.receiptSha256 = sha256(JSON.stringify(receipt)); this.revocations.push(receipt); return Object.freeze(receipt);
  }
  snapshot() { return Object.freeze({ schema: 'nolane.agent.oauth-security-runtime-snapshot.v1', pending: this.pending.size, activeCredentialReferences: this.credentials.size, revocations: this.revocations.length }); }
}
