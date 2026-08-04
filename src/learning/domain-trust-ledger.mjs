import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { number, receipt, signed, text } from './learning-utils.mjs';

const ROLES = new Set(['executor', 'reviewer', 'tool']);

function normalizeKey(input = {}) {
  const role = text(input.role, 'role', 64).toLowerCase();
  if (!ROLES.has(role)) throw new TypeError(`unknown trust role: ${role}`);
  const identity = text(input.identity, 'identity', 256);
  const domain = text(input.domain ?? 'general', 'domain', 128).toLowerCase();
  const taskType = text(input.taskType ?? 'general', 'taskType', 128).toLowerCase();
  const bucketKey = canonicalSha256({ role, identity, domain, taskType });
  return { role, identity, domain, taskType, bucketKey };
}

export class DomainTrustLedger {
  constructor({ maxOutcomes = 100_000 } = {}) {
    this.maxOutcomes = number(maxOutcomes, 'maxOutcomes', { min: 1, max: 1_000_000, integer: true });
    this.outcomes = new Map();
    this.buckets = new Map();
  }

  record(input = {}) {
    if (input.verified !== true) throw new TypeError('verified outcome is required');
    const outcomeId = text(input.outcomeId, 'outcomeId', 256);
    const key = normalizeKey(input);
    const confidence = number(input.confidence, 'confidence', { min: 0, max: 1 });
    if (typeof input.success !== 'boolean') throw new TypeError('success must be boolean');
    const verificationReceiptSha256 = receipt(input.verificationReceiptSha256);
    const brier = (confidence - (input.success ? 1 : 0)) ** 2;
    const fingerprint = canonicalSha256({ ...key, confidence, success: input.success, verificationReceiptSha256 });
    const existing = this.outcomes.get(outcomeId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new TypeError(`trust outcome conflict: ${outcomeId}`);
      return signed({ schema: 'forge.domain-trust-outcome.v1', outcomeId, ...key, confidence, success: input.success, brier, verificationReceiptSha256, duplicate: true });
    }
    if (this.outcomes.size >= this.maxOutcomes) throw new RangeError('trust outcome capacity exceeded');
    const bucket = this.buckets.get(key.bucketKey) ?? { ...key, alpha: 1, beta: 1, sampleCount: 0, brierTotal: 0, staleEvidenceCount: 0 };
    if (input.success) bucket.alpha += 1; else bucket.beta += 1;
    bucket.sampleCount += 1;
    bucket.brierTotal += brier;
    if (input.stale === true) bucket.staleEvidenceCount += 1;
    this.buckets.set(key.bucketKey, bucket);
    this.outcomes.set(outcomeId, { fingerprint });
    return signed({ schema: 'forge.domain-trust-outcome.v1', outcomeId, ...key, confidence, success: input.success, brier, verificationReceiptSha256, duplicate: false });
  }

  project(input = {}) {
    const key = normalizeKey(input);
    const bucket = this.buckets.get(key.bucketKey) ?? { ...key, alpha: 1, beta: 1, sampleCount: 0, brierTotal: 0, staleEvidenceCount: 0 };
    return signed({
      schema: 'forge.domain-trust-projection.v1', ...key,
      sampleCount: bucket.sampleCount,
      alpha: bucket.alpha,
      beta: bucket.beta,
      posteriorSuccessRate: bucket.alpha / (bucket.alpha + bucket.beta),
      brierError: bucket.sampleCount ? bucket.brierTotal / bucket.sampleCount : null,
      staleEvidenceCount: bucket.staleEvidenceCount,
      claims: Object.freeze({ roleIsolated: true, domainConditioned: true, taskTypeConditioned: true, verifiedOutcomesOnly: true }),
    });
  }

  snapshot() {
    const buckets = [...this.buckets.values()].map((bucket) => ({
      role: bucket.role, identity: bucket.identity, domain: bucket.domain, taskType: bucket.taskType, bucketKey: bucket.bucketKey,
      sampleCount: bucket.sampleCount, posteriorSuccessRate: bucket.alpha / (bucket.alpha + bucket.beta),
      brierError: bucket.sampleCount ? bucket.brierTotal / bucket.sampleCount : null, staleEvidenceCount: bucket.staleEvidenceCount,
    })).sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));
    return signed({ schema: 'forge.domain-trust-ledger-snapshot.v1', buckets: Object.freeze(buckets), outcomeCount: this.outcomes.size, claims: { crossRoleEvidenceMerged: false, unverifiedOutcomesStored: false } });
  }
}
