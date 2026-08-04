import { signed, text } from '../construction/construction-utils.mjs';

export class ContaminationGuard {
  assess({ caseId, split, caseFingerprint, exposedFingerprints = [], disclosures = [] } = {}) {
    const id = text(caseId, 'caseId', 512); const kind = text(split, 'split', 128); const fingerprint = text(caseFingerprint, 'caseFingerprint', 128).toLowerCase();
    const exposed = new Set(exposedFingerprints.map((item) => String(item).toLowerCase()));
    const reasons = [];
    if (/private|held-out/i.test(kind) && exposed.has(fingerprint)) reasons.push('hidden-case-fingerprint-exposed');
    if (!Array.isArray(disclosures) || disclosures.some((item) => !item?.system || !item?.status)) reasons.push('contamination-disclosure-incomplete');
    return signed({ schema: 'forge.benchmark-contamination.v1', caseId: id, split: kind, status: reasons.length ? 'block' : 'pass', reasons, exposedFingerprintCount: exposed.size, disclosureCount: disclosures.length, claims: { contaminationProvenAbsent: false, hiddenAnswerStored: false } });
  }
}
