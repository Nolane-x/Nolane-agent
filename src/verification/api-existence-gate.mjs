import { signed, text } from '../construction/construction-utils.mjs';

const HASH = /^[a-f0-9]{64}$/i;

function versionParts(value) {
  const match = String(value ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1).map(Number) : null;
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

function compatible(version, range) {
  if (!range) return true;
  const actual = versionParts(version);
  if (!actual) return false;
  const requested = String(range).trim();
  if (requested.startsWith('^')) {
    const base = versionParts(requested.slice(1));
    return Boolean(base) && actual[0] === base[0] && compare(actual, base) >= 0;
  }
  if (requested.startsWith('>=')) {
    const base = versionParts(requested.slice(2));
    return Boolean(base) && compare(actual, base) >= 0;
  }
  const exact = versionParts(requested);
  return Boolean(exact) && compare(actual, exact) === 0;
}

function normalizeEvidence(item, index) {
  if (!item || typeof item !== 'object') throw new TypeError(`evidence[${index}] must be an object`);
  const receiptSha256 = String(item.receiptSha256 ?? '').toLowerCase();
  if (!HASH.test(receiptSha256)) throw new TypeError(`evidence[${index}].receiptSha256 must be SHA-256`);
  return Object.freeze({
    kind: text(item.kind, `evidence[${index}].kind`, 128),
    name: text(item.name, `evidence[${index}].name`, 512),
    package: item.package == null ? null : text(item.package, `evidence[${index}].package`, 512),
    version: item.version == null ? null : String(item.version).trim(),
    signature: item.signature == null ? null : String(item.signature).replace(/\s+/g, ' ').trim(),
    platforms: Array.isArray(item.platforms) ? [...new Set(item.platforms.map((value) => text(value, 'evidence platform', 64)))].sort() : [],
    deprecated: item.deprecated === true,
    receiptSha256,
  });
}

export class ApiExistenceGate {
  verify({ request = {}, evidence = [], required = true, deprecatedExceptionReceiptSha256 = null } = {}) {
    if (!request || typeof request !== 'object') throw new TypeError('request must be an object');
    if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array');
    const normalizedRequest = Object.freeze({
      kind: text(request.kind, 'request.kind', 64),
      name: text(request.name, 'request.name', 512),
      package: request.package == null ? null : text(request.package, 'request.package', 512),
      versionRange: request.versionRange == null ? null : String(request.versionRange).trim(),
      signature: request.signature == null ? null : String(request.signature).replace(/\s+/g, ' ').trim(),
      platform: request.platform == null ? null : text(request.platform, 'request.platform', 64),
    });
    const normalizedEvidence = evidence.map(normalizeEvidence);
    const matches = normalizedEvidence.filter((item) => item.name === normalizedRequest.name && (normalizedRequest.package == null || item.package === normalizedRequest.package));
    const reasons = [];
    if (!matches.length) reasons.push('no-exact-evidence');
    for (const item of matches) {
      if (normalizedRequest.versionRange && !compatible(item.version, normalizedRequest.versionRange)) reasons.push('version-incompatible');
      if (normalizedRequest.signature && item.signature !== normalizedRequest.signature) reasons.push('signature-mismatch');
      if (item.deprecated && !HASH.test(String(deprecatedExceptionReceiptSha256 ?? ''))) reasons.push('deprecated-without-exception');
      if (normalizedRequest.platform && item.platforms.length && !item.platforms.includes(normalizedRequest.platform)) reasons.push('platform-unsupported');
    }
    const uniqueReasons = [...new Set(reasons)];
    const pass = matches.length > 0 && uniqueReasons.length === 0;
    return signed({
      schema: 'forge.api-existence-decision.v1',
      request: normalizedRequest,
      required: required === true,
      status: pass ? 'pass' : matches.length ? 'fail' : 'unknown',
      allowed: pass || required !== true,
      reasons: uniqueReasons,
      matches,
      evidenceReceiptSha256: matches.map((item) => item.receiptSha256),
      claims: { inferredFromModelMemory: false, unknownTreatedAsSuccess: false },
    });
  }
}
