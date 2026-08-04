import crypto from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function requireText(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

export function verifyThirdPartyProvenance({ noticeText } = {}) {
  if (typeof noticeText !== 'string' || noticeText.trim().length === 0) throw new TypeError('Third-party notice text is required');
  requireText(noticeText, /Nous Research/, 'Nous Research attribution is required');
  requireText(noticeText, /MIT-licensed upstream agent[\s\S]*Copyright \(c\) 2025 Nous Research/i, 'Historical MIT attribution is required');
  requireText(noticeText, /846b14ab01a84483d2c3dd429579173040474585/, 'Historical upstream commit provenance is required');
  requireText(noticeText, /No upstream archive, runtime, API route, executable integration, model profile, adapter, or package is distributed by Nolane Agent/i, 'Nolane runtime purity statement is required');
  requireText(noticeText, /claims ownership only of its independent Nolane Native implementation/i, 'Nolane ownership boundary statement is required');
  requireText(noticeText, /clean-room implementation/i, 'Clean-room transformation statement is required');
  requireText(noticeText, /requirements\/nolane-native-transformation-ledger\.jsonl/, 'Transformation ledger provenance is required');
  if (/Nolane(?: Agent)?\s+(?:owns|claims ownership of)\s+(?:upstream|third-party)\s+source code/i.test(noticeText)) throw new Error('Third-party ownership claim is forbidden');
  const base = {
    schema: 'nolane.release.third-party-provenance.v2',
    valid: true,
    noticeSha256: sha256(noticeText),
    historicalResearchAttribution: {
      upstream: 'Nous Research',
      upstreamCommit: '846b14ab01a84483d2c3dd429579173040474585',
      license: 'MIT',
      runtimeDistributed: false,
      ownershipClaimed: false,
      cleanRoomTransformation: true,
      transformationLedger: 'requirements/nolane-native-transformation-ledger.jsonl',
    },
  };
  return Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(canonical(base))) });
}
