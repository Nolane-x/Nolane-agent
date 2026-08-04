import { createPublicKey, verify } from 'node:crypto';

const VERIFY_ALGORITHMS = Object.freeze({ RS256: 'RSA-SHA256', RS384: 'RSA-SHA384', RS512: 'RSA-SHA512' });

function decodeJsonSegment(segment, label) {
  try { return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')); }
  catch { throw Object.assign(new Error(`Invalid JWT ${label}`), { statusCode: 401, code: `oidc-invalid-${label}` }); }
}

export function createOidcJwksVerifier({ jwksUri, fetchImpl = globalThis.fetch, allowedAlgorithms = ['RS256'], cacheTtlMs = 300_000, clock = () => Date.now(), timeoutMs = 10_000 } = {}) {
  if (!jwksUri || typeof fetchImpl !== 'function') throw new TypeError('jwksUri and fetchImpl are required');
  const allowed = new Set(allowedAlgorithms.map(String));
  let cachedKeys = [];
  let cacheExpiresAt = 0;

  async function loadKeys({ force = false } = {}) {
    if (!force && cachedKeys.length && clock() < cacheExpiresAt) return cachedKeys;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 10_000));
    timer.unref?.();
    try {
      const response = await fetchImpl(String(jwksUri), { headers: { accept: 'application/json' }, signal: controller.signal });
      if (!response?.ok) throw Object.assign(new Error(`JWKS endpoint returned ${response?.status ?? 'an error'}`), { statusCode: 502, code: 'oidc-jwks-fetch-failed' });
      const body = await response.json();
      if (!body || !Array.isArray(body.keys)) throw Object.assign(new Error('JWKS response is invalid'), { statusCode: 502, code: 'oidc-jwks-invalid' });
      cachedKeys = body.keys.filter((key) => key && typeof key === 'object' && key.kid && (!key.use || key.use === 'sig'));
      cacheExpiresAt = clock() + Math.max(1_000, Number(cacheTtlMs) || 300_000);
      return cachedKeys;
    } finally { clearTimeout(timer); }
  }

  return async function verifyJwt(token) {
    const compact = String(token ?? '');
    if (!compact || compact.length > 32_768) throw Object.assign(new Error('OIDC token is missing or too large'), { statusCode: 401, code: 'oidc-token-invalid' });
    const parts = compact.split('.');
    if (parts.length !== 3 || !parts[2]) throw Object.assign(new Error('OIDC token must be a signed compact JWT'), { statusCode: 401, code: 'oidc-token-unsigned' });
    const header = decodeJsonSegment(parts[0], 'header');
    const payload = decodeJsonSegment(parts[1], 'payload');
    const algorithm = String(header.alg ?? '');
    if (!allowed.has(algorithm) || !VERIFY_ALGORITHMS[algorithm]) throw Object.assign(new Error('OIDC signing algorithm is not allowed'), { statusCode: 401, code: 'oidc-algorithm-denied' });
    const kid = String(header.kid ?? '');
    if (!kid) throw Object.assign(new Error('OIDC signing key id is missing'), { statusCode: 401, code: 'oidc-kid-missing' });
    let keys = await loadKeys();
    let jwk = keys.find((key) => String(key.kid) === kid && (!key.alg || String(key.alg) === algorithm));
    if (!jwk) {
      keys = await loadKeys({ force: true });
      jwk = keys.find((key) => String(key.kid) === kid && (!key.alg || String(key.alg) === algorithm));
    }
    if (!jwk) throw Object.assign(new Error('OIDC signing key was not found'), { statusCode: 401, code: 'oidc-key-not-found' });
    let publicKey;
    try { publicKey = createPublicKey({ key: jwk, format: 'jwk' }); }
    catch { throw Object.assign(new Error('OIDC signing key is invalid'), { statusCode: 401, code: 'oidc-key-invalid' }); }
    const valid = verify(VERIFY_ALGORITHMS[algorithm], Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
    if (!valid) throw Object.assign(new Error('OIDC token signature is invalid'), { statusCode: 401, code: 'oidc-signature-invalid' });
    return Object.freeze({ ...payload });
  };
}
