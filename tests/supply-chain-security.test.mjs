import test from 'node:test';
import assert from 'node:assert/strict';
import { DependencyRiskIntelligence } from '../src/security/dependency-risk-intelligence.mjs';
import { SbomProvenanceService } from '../src/security/sbom-provenance-service.mjs';
import { IntegrityQuarantine } from '../src/security/integrity-quarantine.mjs';

const sha = (c) => c.repeat(64);

test('dependency risk blocks malicious or incompatible upgrade evidence', () => {
  const service = new DependencyRiskIntelligence();
  const report = service.assess({
    dependency: { name: 'left-pad-plus', currentVersion: '1.0.0', candidateVersion: '9.0.0' },
    evidence: {
      vulnerabilities: [{ id: 'CVE-X', severity: 'critical', affected: true }],
      licenses: [{ id: 'GPL-3.0', allowed: false }],
      abandonment: { lastReleaseDays: 2500, maintainers: 0 },
      maliciousSignals: [{ kind: 'typosquat', confidence: 0.97 }],
    },
    compatibility: { status: 'unverified', apiReceiptSha256: null, testReceiptSha256: null },
  });
  assert.equal(report.status, 'block');
  assert.ok(report.reasons.includes('critical-vulnerability'));
  assert.ok(report.reasons.includes('compatibility-unverified'));
});

test('SBOM records exact component and artifact provenance without raw content', () => {
  const report = new SbomProvenanceService().generate({
    commit: sha('a'),
    components: [{ type: 'library', name: 'pkg', version: '1.2.3', digest: sha('b'), origin: 'lockfile', license: 'MIT' }],
    artifacts: [{ type: 'model-pack', name: 'embed-int8', version: '1', digest: sha('c'), origin: 'local-pack' }],
  });
  assert.equal(report.components.length, 2);
  assert.equal(report.components[1].type, 'model-pack');
  assert.equal(JSON.stringify(report).includes('rawContent'), false);
});

test('integrity quarantine blocks digest, provenance, policy, or compatibility failures', () => {
  const report = new IntegrityQuarantine().evaluate({
    subject: { kind: 'plugin', id: 'demo', version: '1.0.0' },
    integrity: { expectedSha256: sha('d'), actualSha256: sha('e'), signatureVerified: false },
    policy: { allowed: false, reasons: ['untrusted-origin'] },
    compatibility: { status: 'unverified' },
  });
  assert.equal(report.status, 'quarantine');
  assert.deepEqual(new Set(report.reasons), new Set(['digest-mismatch', 'signature-unverified', 'policy-denied', 'compatibility-unverified']));
});
