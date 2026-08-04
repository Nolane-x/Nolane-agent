import { createPublicKey } from 'node:crypto';
import { PluginTrustStore } from './plugin-trust-store.mjs';

const MAX_TRUST_JSON_BYTES = 1_000_000;
const MODES = new Set(['development', 'required']);

function requiredString(value, name) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${name} is required`);
  return output;
}

export function loadPluginTrustConfiguration({ trustMode = 'development', trustJson = '', signingService } = {}) {
  const mode = String(trustMode || 'development').trim().toLowerCase();
  if (!MODES.has(mode)) throw new TypeError('plugin trust mode must be development or required');
  const source = String(trustJson ?? '');
  if (Buffer.byteLength(source, 'utf8') > MAX_TRUST_JSON_BYTES) throw new RangeError('plugin trust configuration is too large');
  const records = source.trim() ? JSON.parse(source) : [];
  if (!Array.isArray(records)) throw new TypeError('plugin trust configuration must be an array');
  if (records.length > 10_000) throw new RangeError('plugin trust configuration contains too many publisher keys');

  const trustStore = new PluginTrustStore({ signingService });
  for (const input of records) {
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new TypeError('publisher key record must be an object');
    const publisherId = requiredString(input.publisherId, 'publisherId');
    const keyId = requiredString(input.keyId, 'keyId');
    const publicKeyText = requiredString(input.publicKey, 'publicKey');
    if (/PRIVATE KEY/i.test(publicKeyText)) throw new TypeError('only public key material is accepted');
    let publicKey;
    try {
      publicKey = createPublicKey(publicKeyText);
    } catch (error) {
      throw new TypeError(`invalid public key for ${publisherId}:${keyId}: ${error.message}`);
    }
    const scopes = input.scopes == null ? ['*'] : input.scopes;
    if (!Array.isArray(scopes) || scopes.length === 0 || scopes.length > 1_000) throw new TypeError('publisher key scopes must be a non-empty array');
    trustStore.addPublisher({ publisherId, keyId, publicKey, scopes: scopes.map((scope) => requiredString(scope, 'scope')) });
    if (input.revoked === true) trustStore.revokeKey({ publisherId, keyId, reason: String(input.reason ?? 'revoked').slice(0, 500) });
  }
  return Object.freeze({ trustMode: mode, trustStore });
}
