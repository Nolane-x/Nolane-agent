import { createOidcJwksVerifier } from './oidc-jwks-verifier.mjs';
import { OidcService } from './oidc-service.mjs';

const MAX_JSON_BYTES = 1_000_000;
function required(value, name) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${name} is required`); return text; }
function httpsUrl(value, name, { allowLoopbackHttp = false } = {}) {
  const url = new URL(required(value, name));
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLoopbackHttp && loopback && url.protocol === 'http:')) throw new TypeError(`${name} must use HTTPS`);
  if (url.username || url.password) throw new TypeError(`${name} must not embed credentials`);
  return url.toString();
}
function stringList(value, fallback = []) { const source = value == null ? fallback : value; if (!Array.isArray(source) || source.length > 100) throw new TypeError('OIDC list must be a bounded array'); return [...new Set(source.map((item) => required(item, 'OIDC list item')))]; }

export function loadOidcProviderRegistry({ json = '[]', environment = process.env, fetchImpl = globalThis.fetch } = {}) {
  const source = String(json ?? '[]');
  if (Buffer.byteLength(source, 'utf8') > MAX_JSON_BYTES) throw new RangeError('OIDC provider configuration is too large');
  const parsed = source.trim() ? JSON.parse(source) : [];
  if (!Array.isArray(parsed) || parsed.length > 1_000) throw new TypeError('OIDC provider configuration must be a bounded array');
  const records = new Map();
  for (const input of parsed) {
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new TypeError('OIDC provider record must be an object');
    if (Object.hasOwn(input, 'clientSecret')) throw new TypeError('Inline client secrets are forbidden; use clientSecretEnv');
    const organizationId = required(input.organizationId, 'organizationId');
    if (records.has(organizationId)) throw new TypeError(`Duplicate OIDC tenant: ${organizationId}`);
    const issuer = httpsUrl(input.issuer, 'issuer');
    const clientId = required(input.clientId, 'clientId');
    const verifier = createOidcJwksVerifier({ jwksUri: httpsUrl(input.jwksUri, 'jwksUri'), fetchImpl, allowedAlgorithms: input.allowedAlgorithms ?? ['RS256'] });
    const oidcService = new OidcService({ issuer, clientId, verifier });
    const groupRoleMap = {};
    for (const [group, roles] of Object.entries(input.groupRoleMap ?? {})) groupRoleMap[required(group, 'OIDC group')] = stringList(roles);
    records.set(organizationId, Object.freeze({
      organizationId,
      issuer,
      authorizationEndpoint: httpsUrl(input.authorizationEndpoint, 'authorizationEndpoint'),
      tokenEndpoint: httpsUrl(input.tokenEndpoint, 'tokenEndpoint'),
      clientId,
      clientSecretEnv: input.clientSecretEnv ? required(input.clientSecretEnv, 'clientSecretEnv') : null,
      redirectUri: httpsUrl(input.redirectUri, 'redirectUri', { allowLoopbackHttp: true }),
      scopes: Object.freeze(stringList(input.scopes, ['openid', 'profile', 'email'])),
      groupRoleMap: Object.freeze(groupRoleMap),
      oidcService,
    }));
  }
  const resolve = (organizationId) => {
    const record = records.get(required(organizationId, 'organizationId'));
    if (!record) throw Object.assign(new Error('OIDC provider is not configured for organization'), { statusCode: 404, code: 'oidc-provider-not-found' });
    const clientSecret = record.clientSecretEnv ? required(environment[record.clientSecretEnv], `environment variable ${record.clientSecretEnv}`) : null;
    return Object.freeze({ organizationId: record.organizationId, issuer: record.issuer, authorizationEndpoint: record.authorizationEndpoint, tokenEndpoint: record.tokenEndpoint, clientId: record.clientId, ...(clientSecret ? { clientSecret } : {}), redirectUri: record.redirectUri, scopes: record.scopes, oidcService: record.oidcService });
  };
  const rolesFor = (organizationId, groups = []) => {
    const record = records.get(required(organizationId, 'organizationId'));
    if (!record) return [];
    return [...new Set(stringList(groups).flatMap((group) => record.groupRoleMap[group] ?? []))].sort();
  };
  return Object.freeze({ size: records.size, resolve, rolesFor, organizations: () => Object.freeze([...records.keys()].sort()) });
}
