function bearer(headers = {}) { const value = String(headers.authorization ?? headers.Authorization ?? ''); return value.startsWith('Bearer ') ? value.slice(7).trim() : ''; }
function audienceIncludes(aud, expected) { return Array.isArray(aud) ? aud.includes(expected) : String(aud ?? '') === expected; }
export class OAuthResourceServer {
  constructor({ issuer, audience, verifier, clock = () => Date.now() } = {}) { if (!issuer || !audience || typeof verifier !== 'function') throw new TypeError('issuer, audience and verifier are required'); this.issuer = String(issuer); this.audience = String(audience); this.verifier = verifier; this.clock = clock; }
  async authenticate(request = {}, requirements = {}) { const token = bearer(request.headers); if (!token) throw Object.assign(new Error('Bearer token is required'), { statusCode: 401, code: 'oauth-token-missing' }); const claims = await this.verifier(token); if (!claims) throw Object.assign(new Error('Bearer token is invalid'), { statusCode: 401, code: 'oauth-token-invalid' }); if (claims.iss !== this.issuer) throw Object.assign(new Error('Token issuer mismatch'), { statusCode: 401, code: 'oauth-issuer' }); if (!audienceIncludes(claims.aud, this.audience)) throw Object.assign(new Error('Token audience mismatch'), { statusCode: 401, code: 'oauth-audience' }); if (Number(claims.exp ?? 0) <= Math.floor(this.clock()/1000)) throw Object.assign(new Error('Token expired'), { statusCode: 401, code: 'oauth-expired' }); const scopes = new Set(String(claims.scope ?? '').split(/\s+/).filter(Boolean)); for (const scope of requirements.scopes ?? []) if (!scopes.has(scope)) throw Object.assign(new Error(`Required scope missing: ${scope}`), { statusCode: 403, code: 'oauth-scope' }); const organizationId = String(claims.organization_id ?? ''); const workspaceId = String(claims.workspace_id ?? ''); if (requirements.organizationId && organizationId !== String(requirements.organizationId)) throw Object.assign(new Error('Token organization mismatch'), { statusCode: 403, code: 'oauth-tenant' }); if (requirements.workspaceId && workspaceId !== String(requirements.workspaceId)) throw Object.assign(new Error('Token workspace mismatch'), { statusCode: 403, code: 'oauth-workspace' }); return Object.freeze({ subject: String(claims.sub ?? ''), organizationId, workspaceId, scopes: Object.freeze([...scopes]), tokenId: claims.jti ? String(claims.jti) : null }); }
}

export function createOAuthIntrospectionVerifier({ endpoint, clientId, clientSecret, fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const url = new URL(String(endpoint ?? ''));
  if (url.protocol !== 'https:') throw new TypeError('OAuth introspection endpoint must use HTTPS');
  if (!clientId || !clientSecret || typeof fetchImpl !== 'function') throw new TypeError('clientId, clientSecret and fetchImpl are required');
  const authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  return async function verifyOpaqueToken(token) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 10_000)); timer.unref?.();
    try {
      const response = await fetchImpl(url, { method: 'POST', signal: controller.signal, headers: { authorization, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ token: String(token), token_type_hint: 'access_token' }) });
      if (!response.ok) throw Object.assign(new Error(`OAuth introspection failed: ${response.status}`), { statusCode: 503, code: 'oauth-introspection-failed' });
      const claims = await response.json(); return claims?.active === true ? claims : null;
    } finally { clearTimeout(timer); }
  };
}
