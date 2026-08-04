import { createHash, randomBytes } from 'node:crypto';

function required(value, name) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${name} is required`); return text; }
function randomSecret(bytes = 32) { return randomBytes(bytes).toString('base64url'); }

export class OidcLoginManager {
  constructor({ providerResolver, fetchImpl = globalThis.fetch, clock = () => Date.now(), stateTtlMs = 10 * 60_000, timeoutMs = 10_000 } = {}) {
    if (typeof providerResolver !== 'function' || typeof fetchImpl !== 'function') throw new TypeError('providerResolver and fetchImpl are required');
    this.providerResolver = providerResolver; this.fetchImpl = fetchImpl; this.clock = clock; this.stateTtlMs = Math.max(30_000, Number(stateTtlMs) || 600_000); this.timeoutMs = Math.max(100, Number(timeoutMs) || 10_000); this.sessions = new Map();
  }
  begin({ organizationId, returnTo = null } = {}) {
    const org = required(organizationId, 'organizationId'); const provider = this.providerResolver(org);
    const state = randomSecret(); const nonce = randomSecret(); const codeVerifier = randomSecret(48); const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    this.sessions.set(state, { organizationId: org, nonce, codeVerifier, createdAt: this.clock(), expiresAt: this.clock() + this.stateTtlMs, returnTo: returnTo ? String(returnTo) : null });
    const authorizationUrl = new URL(required(provider.authorizationEndpoint, 'authorizationEndpoint'));
    authorizationUrl.searchParams.set('response_type', 'code'); authorizationUrl.searchParams.set('client_id', required(provider.clientId, 'clientId')); authorizationUrl.searchParams.set('redirect_uri', required(provider.redirectUri, 'redirectUri')); authorizationUrl.searchParams.set('scope', (provider.scopes ?? ['openid']).map(String).join(' ')); authorizationUrl.searchParams.set('state', state); authorizationUrl.searchParams.set('nonce', nonce); authorizationUrl.searchParams.set('code_challenge', codeChallenge); authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    return Object.freeze({ organizationId: org, state, authorizationUrl: authorizationUrl.toString(), expiresAt: this.sessions.get(state).expiresAt });
  }
  async complete({ state, code } = {}) {
    const key = required(state, 'state'); const session = this.sessions.get(key); this.sessions.delete(key);
    if (!session || session.expiresAt <= this.clock()) throw Object.assign(new Error('OIDC state is invalid or expired'), { statusCode: 401, code: 'oidc-state-invalid' });
    const provider = this.providerResolver(session.organizationId); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs); timer.unref?.();
    let response;
    try {
      response = await this.fetchImpl(required(provider.tokenEndpoint, 'tokenEndpoint'), { method: 'POST', signal: controller.signal, headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: required(code, 'authorization code'), redirect_uri: required(provider.redirectUri, 'redirectUri'), client_id: required(provider.clientId, 'clientId'), code_verifier: session.codeVerifier, ...(provider.clientSecret ? { client_secret: String(provider.clientSecret) } : {}) }) });
    } finally { clearTimeout(timer); }
    if (!response?.ok) throw Object.assign(new Error(`OIDC token exchange failed: ${response?.status ?? 'unknown'}`), { statusCode: 502, code: 'oidc-token-exchange-failed' });
    const tokens = await response.json();
    if (!tokens?.id_token) throw Object.assign(new Error('OIDC provider did not return an ID token'), { statusCode: 502, code: 'oidc-id-token-missing' });
    const principal = await provider.oidcService.validateLoginCallback({ idToken: tokens.id_token, expectedState: key, state: key, expectedNonce: session.nonce, organizationId: session.organizationId });
    return Object.freeze({ ...principal, returnTo: session.returnTo });
  }
  sweep() { const now = this.clock(); let removed = 0; for (const [state, session] of this.sessions) if (session.expiresAt <= now) { this.sessions.delete(state); removed += 1; } return removed; }
}
