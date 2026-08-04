import { signed } from '../construction/construction-utils.mjs';
import { BenchmarkScorer } from './benchmark-scorer.mjs';
import { benchmarkRunDigest } from './independent-attestation.mjs';

export class ComparativeCertificationService {
  constructor({ minimumTasks = 20 } = {}) { this.minimumTasks = Number(minimumTasks); if (!Number.isInteger(this.minimumTasks) || this.minimumTasks < 1) throw new TypeError('minimumTasks is invalid'); }
  certify({ suite, runs = [], contracts = [], attestation = null } = {}) {
    if (!suite || typeof suite !== 'object') throw new TypeError('suite is required');
    if (!Array.isArray(runs) || !runs.length) throw new TypeError('runs are required');
    const reasons = [];
    if (runs.some((run) => String(run.providerKind) === 'fake' || run.smokeOnly === true)) reasons.push('fake-provider-present');
    if (!Array.isArray(contracts) || !contracts.length || contracts.some((item) => item?.status !== 'pass')) reasons.push('incomparable-contract');
    if (runs.some((run) => run.benchmarkSpecificBehaviorDetected === true)) reasons.push('benchmark-specific-behavior');
    if (attestation?.verified !== true) reasons.push('independent-attestation-missing');
    const digest = benchmarkRunDigest(runs);
    if (attestation?.verified === true && String(attestation.runDigest ?? '') !== digest) reasons.push('attestation-run-digest-mismatch');
    const independentEvidence = reasons.includes('independent-attestation-missing') || reasons.includes('attestation-run-digest-mismatch') ? null : { verified: true, claimantSystem: String(attestation.claimantSystem ?? ''), runDigest: digest, operator: attestation.operator ?? null };
    const comparison = new BenchmarkScorer().compareSystems(runs, { independentEvidence, minimumTasks: this.minimumTasks });
    if (comparison.commonTaskCount < this.minimumTasks) reasons.push('minimum-common-task-threshold');
    if (!comparison.claimAllowed) reasons.push('statistical-separation-not-proven');
    const unique = [...new Set(reasons)];
    return signed({ schema: 'forge.comparative-certification.v1', suite: { id: String(suite.id ?? ''), version: Number(suite.version ?? 1), distributionId: suite.distribution?.id ?? null, distributionVersion: suite.distribution?.version ?? null }, claimAllowed: unique.length === 0, reasons: unique, claimantSystem: comparison.claimantSystem, commonTaskCount: comparison.commonTaskCount, independent: comparison.independent, runDigest: digest, systems: comparison.systems, claims: { fakeProviderCertified: false, privateHeldOutSuiteCertified: false, platformMatrixCertified: false } });
  }
}
