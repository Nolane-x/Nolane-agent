import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = Object.freeze([
  'completeParityClaimAllowed',
  'comparativeSuperiorityClaimAllowed',
  'windowsUiCertified',
  'providerRealCertified',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  for (const key of Object.keys(value)) value[key] = freeze(value[key]);
  return Object.freeze(value);
}

function evidenceList(values, label, requiredFields) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  return values.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`${label}[${index}] must be an object`);
    const normalized = {};
    for (const field of requiredFields) {
      const value = String(item[field] ?? '').trim();
      if (!value) throw new TypeError(`${label}[${index}].${field} is required`);
      normalized[field] = value;
    }
    if (!SHA256.test(String(item.evidenceSha256 ?? ''))) throw new TypeError(`${label}[${index}].evidenceSha256 must be a lowercase SHA-256`);
    normalized.evidenceSha256 = String(item.evidenceSha256);
    return freeze(normalized);
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function buildReleaseNonClaimManifest({ version, claims = {}, externalGates = [], failures = [] } = {}) {
  const productVersion = String(version ?? '').trim();
  if (!productVersion) throw new TypeError('version is required');
  const protectedClaims = {};
  for (const key of PROTECTED) {
    const value = claims[key] ?? false;
    if (value !== false) throw new Error(`Protected claim ${key} must remain false`);
    protectedClaims[key] = false;
  }
  const normalizedGates = evidenceList(externalGates, 'externalGates', ['id', 'reason']);
  const normalizedFailures = evidenceList(failures, 'failures', ['id', 'stage']);
  const base = {
    schema: 'nolane.release.non-claim-manifest.v1',
    product: 'Nolane Agent',
    version: productVersion,
    claims: protectedClaims,
    externalGates: normalizedGates,
    failures: normalizedFailures,
    sourceCountIsProof: false,
  };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
