import { signed, strings, text } from '../construction/construction-utils.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const RESOLUTION_STATUS = new Set(['repaired', 'accepted-exception', 'verified-rebuttal']);

function identity(value, label) {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} is required`);
  return Object.freeze({
    id: text(value.id, `${label}.id`, 256),
    providerId: text(value.providerId, `${label}.providerId`, 256),
    model: text(value.model, `${label}.model`, 256),
    harnessProfile: text(value.harnessProfile, `${label}.harnessProfile`, 256),
    role: String(value.role ?? (label === 'executor' ? 'executor' : 'reviewer')).slice(0, 128),
  });
}

function chooseReviewer(executor, candidates) {
  const normalized = candidates.map((item, index) => identity(item, `reviewerCandidates[${index}]`)).filter((item) => item.id !== executor.id);
  const providerModel = normalized.find((item) => item.providerId !== executor.providerId || item.model !== executor.model);
  if (providerModel) return { reviewer: providerModel, kind: 'provider-model' };
  const harnessRole = normalized.find((item) => item.harnessProfile !== executor.harnessProfile && item.role === 'reviewer');
  if (harnessRole) return { reviewer: harnessRole, kind: 'harness-role' };
  throw new Error('No independent reviewer candidate is available');
}

function boundedPublicArray(value, label, max = 500) {
  if (!Array.isArray(value ?? [])) throw new TypeError(`${label} must be an array`);
  return Object.freeze((value ?? []).slice(0, max).map((item) => {
    const encoded = JSON.stringify(item);
    if (Buffer.byteLength(encoded) > 16_000) throw new RangeError(`${label} item exceeds 16000 bytes`);
    return JSON.parse(encoded);
  }));
}

export class AdversarialReviewCoordinator {
  constructor({ reviewService } = {}) {
    if (!reviewService || typeof reviewService.review !== 'function') throw new TypeError('reviewService.review is required');
    this.reviewService = reviewService;
  }

  async review({ projectId, executor, reviewerCandidates = [], diff, requirements = [], evidence = [], testReceipts = [], residualRisks = [], semanticFindings = [], rules = [], resolutions = [] } = {}) {
    const project = text(projectId, 'projectId', 512);
    const executorIdentity = identity(executor, 'executor');
    if (!Array.isArray(reviewerCandidates) || reviewerCandidates.length === 0) throw new TypeError('reviewerCandidates are required');
    const selection = chooseReviewer(executorIdentity, reviewerCandidates);
    const reviewContext = Object.freeze({
      requirements: boundedPublicArray(requirements, 'requirements', 200),
      evidence: boundedPublicArray(evidence, 'evidence', 500),
      testReceipts: boundedPublicArray(testReceipts, 'testReceipts', 500),
      residualRisks: boundedPublicArray(residualRisks, 'residualRisks', 200),
      semanticFindings: boundedPublicArray(semanticFindings, 'semanticFindings', 500),
    });
    const review = await this.reviewService.review({
      projectId: project,
      diff: text(diff, 'diff', 2_000_000),
      executorId: executorIdentity.id,
      reviewerId: selection.reviewer.id,
      rules: strings(rules, 'rules', 100, 2_000),
      reviewContext,
    });
    const resolutionMap = new Map();
    for (const resolution of resolutions ?? []) {
      const fingerprint = String(resolution?.findingFingerprint ?? '').toLowerCase();
      const receiptSha256 = String(resolution?.receiptSha256 ?? '').toLowerCase();
      const status = String(resolution?.status ?? '');
      if (!HASH.test(fingerprint) || !HASH.test(receiptSha256) || !RESOLUTION_STATUS.has(status)) throw new TypeError('resolution requires findingFingerprint, supported status, and receipt SHA-256');
      resolutionMap.set(fingerprint, Object.freeze({ findingFingerprint: fingerprint, status, receiptSha256 }));
    }
    const blocking = (review.findings ?? []).filter((finding) => ['high', 'critical'].includes(String(finding.severity)));
    const unresolved = blocking.filter((finding) => !resolutionMap.has(String(finding.fingerprint).toLowerCase())).map((finding) => String(finding.fingerprint).toLowerCase()).sort();
    return signed({
      schema: 'forge.adversarial-review-decision.v1',
      projectId: project,
      executor: executorIdentity,
      reviewer: selection.reviewer,
      independence: { kind: selection.kind, providerDifferent: selection.reviewer.providerId !== executorIdentity.providerId, modelDifferent: selection.reviewer.model !== executorIdentity.model, harnessDifferent: selection.reviewer.harnessProfile !== executorIdentity.harnessProfile },
      reviewId: review.reviewId,
      reviewReceiptSha256: review.receiptSha256,
      findingFingerprints: (review.findings ?? []).map((finding) => finding.fingerprint),
      resolutions: [...resolutionMap.values()],
      unresolvedFindingFingerprints: unresolved,
      status: unresolved.length ? 'blocked' : 'pass',
      claims: { executorRationaleShared: false, rawPromptShared: false, rawModelOutputShared: false, disagreementMustResolve: true },
    });
  }
}
