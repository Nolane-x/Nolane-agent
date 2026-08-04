import { signed, text } from '../construction/construction-utils.mjs';

const SEVERITY = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

export class DependencyRiskIntelligence {
  assess({ dependency, evidence = {}, compatibility = {} } = {}) {
    const name = text(dependency?.name, 'dependency.name', 512);
    const currentVersion = String(dependency.currentVersion ?? 'unknown').slice(0, 128);
    const candidateVersion = String(dependency.candidateVersion ?? currentVersion).slice(0, 128);
    const reasons = [];
    let risk = 0;
    for (const finding of evidence.vulnerabilities ?? []) {
      if (finding?.affected !== true) continue;
      const severity = String(finding.severity ?? 'medium').toLowerCase();
      risk += SEVERITY[severity] ?? 2;
      if (severity === 'critical') reasons.push('critical-vulnerability');
      else if (severity === 'high') reasons.push('high-vulnerability');
    }
    if ((evidence.licenses ?? []).some((entry) => entry?.allowed === false)) { reasons.push('license-denied'); risk += 3; }
    const abandonment = evidence.abandonment ?? {};
    if (Number(abandonment.lastReleaseDays ?? 0) > 1095 || Number(abandonment.maintainers ?? 1) < 1) { reasons.push('abandonment-risk'); risk += 2; }
    if ((evidence.maliciousSignals ?? []).some((entry) => Number(entry?.confidence ?? 0) >= 0.8)) { reasons.push('malicious-package-signal'); risk += 4; }
    if (compatibility.status !== 'verified' || !compatibility.apiReceiptSha256 || !compatibility.testReceiptSha256) reasons.push('compatibility-unverified');
    const unique = [...new Set(reasons)];
    return signed({
      schema: 'forge.dependency-risk.v1',
      dependency: { name, currentVersion, candidateVersion },
      status: unique.length ? 'block' : risk >= 3 ? 'review' : 'pass',
      riskScore: risk,
      reasons: unique,
      evidenceCounts: { vulnerabilities: (evidence.vulnerabilities ?? []).length, licenses: (evidence.licenses ?? []).length, maliciousSignals: (evidence.maliciousSignals ?? []).length },
      compatibility: { status: compatibility.status ?? 'unverified', apiVerified: Boolean(compatibility.apiReceiptSha256), testsVerified: Boolean(compatibility.testReceiptSha256) },
      claims: { implicitNetworkLookupPerformed: false, automaticUpgradePerformed: false },
    });
  }
}
