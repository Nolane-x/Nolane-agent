function audIncludes(aud, expected) { return Array.isArray(aud) ? aud.includes(expected) : String(aud ?? '') === expected; }
export class OidcService {
  constructor({ issuer, clientId, verifier, clock = () => Date.now() } = {}) {
    if (!issuer || !clientId || typeof verifier !== 'function') throw new TypeError('issuer, clientId and verifier are required');
    this.issuer = String(issuer); this.clientId = String(clientId); this.verifier = verifier; this.clock = clock;
  }
  async validateLoginCallback(input = {}) {
    if (!input.idToken) throw Object.assign(new Error('ID token is required'), { statusCode: 401, code: 'oidc-token-missing' });
    if (!input.expectedState || input.state !== input.expectedState) throw Object.assign(new Error('OIDC state mismatch'), { statusCode: 401, code: 'oidc-state-mismatch' });
    const claims = await this.verifier(String(input.idToken));
    if (!claims || claims.iss !== this.issuer) throw Object.assign(new Error('OIDC issuer mismatch'), { statusCode: 401, code: 'oidc-issuer-mismatch' });
    if (!audIncludes(claims.aud, this.clientId)) throw Object.assign(new Error('OIDC audience mismatch'), { statusCode: 401, code: 'oidc-audience-mismatch' });
    if (Number(claims.exp ?? 0) <= Math.floor(this.clock() / 1000)) throw Object.assign(new Error('OIDC token expired'), { statusCode: 401, code: 'oidc-expired' });
    if (!input.expectedNonce || claims.nonce !== input.expectedNonce) throw Object.assign(new Error('OIDC nonce mismatch'), { statusCode: 401, code: 'oidc-nonce-mismatch' });
    const organizationId = String(claims.organization_id ?? '');
    if (!organizationId || organizationId !== String(input.organizationId ?? '')) throw Object.assign(new Error('OIDC organization mismatch'), { statusCode: 403, code: 'oidc-tenant-mismatch' });
    return Object.freeze({ subject: String(claims.sub), organizationId, email: claims.email ? String(claims.email) : null, groups: Object.freeze(Array.isArray(claims.groups) ? claims.groups.map(String) : []) });
  }
}
