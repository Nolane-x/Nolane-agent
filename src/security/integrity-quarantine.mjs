import { signed, text } from '../construction/construction-utils.mjs';

export class IntegrityQuarantine {
  evaluate({ subject, integrity = {}, policy = {}, compatibility = {} } = {}) {
    const reasons = [];
    if (String(integrity.expectedSha256 ?? '').toLowerCase() !== String(integrity.actualSha256 ?? '').toLowerCase()) reasons.push('digest-mismatch');
    if (integrity.signatureVerified !== true) reasons.push('signature-unverified');
    if (policy.allowed !== true) reasons.push('policy-denied');
    if (compatibility.status !== 'verified') reasons.push('compatibility-unverified');
    return signed({
      schema: 'forge.integrity-quarantine.v1',
      subject: { kind: text(subject?.kind, 'subject.kind', 128), id: text(subject?.id, 'subject.id', 512), version: String(subject?.version ?? 'unknown').slice(0, 128) },
      status: reasons.length ? 'quarantine' : 'allow',
      reasons,
      evidence: { digestMatched: !reasons.includes('digest-mismatch'), signatureVerified: integrity.signatureVerified === true, policyAllowed: policy.allowed === true, compatibilityVerified: compatibility.status === 'verified' },
      claims: { quarantinedSubjectExecuted: false },
    });
  }
}
