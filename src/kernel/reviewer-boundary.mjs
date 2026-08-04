import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { deepFreeze, nowIso, required, signed, uniqueStrings } from './kernel-utils.mjs';

const RISK_ORDER = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 });
const SENSITIVE_CAPABILITY = /(?:^|\.)(?:secret|credential)(?:\.|$)|^(?:network\.unrestricted|process\.elevated|filesystem\.outside-project|git\.force|release\.publish|system\.)/i;

function normalizeRisk(value, capability = '') {
  const requested = String(value ?? '').toLowerCase();
  if (requested in RISK_ORDER) return requested;
  if (SENSITIVE_CAPABILITY.test(capability)) return 'high';
  if (/write|delete|process|network|mcp\.invoke/i.test(capability)) return 'medium';
  return 'low';
}

export class SovereignReviewerBoundary {
  constructor({ reviewerId = 'kernel-reviewer', scanners = [], clock = Date.now, autoApproveThrough = 'low' } = {}) {
    this.reviewerId = required(reviewerId, 'reviewerId', 256);
    this.scanners = Array.isArray(scanners) ? scanners.filter((item) => typeof item === 'function') : [];
    this.clock = clock;
    this.autoApproveThrough = String(autoApproveThrough) in RISK_ORDER ? String(autoApproveThrough) : 'low';
  }

  async reviewCapability({ request, actorId, policy = {} } = {}) {
    const capability = required(request?.capability, 'capability', 256);
    const risk = normalizeRisk(request?.risk, capability);
    const findings = [];
    if (String(actorId ?? '') === this.reviewerId) findings.push({ severity: 'high', code: 'REVIEWER_ACTOR_COLLISION', message: 'Acting agent cannot review its own escalation.' });
    if (request?.scope === 'project' && RISK_ORDER[risk] >= RISK_ORDER.medium) findings.push({ severity: 'medium', code: 'BROAD_SCOPE', message: 'Project-wide capability scope requires explicit human approval.' });
    if (SENSITIVE_CAPABILITY.test(capability)) findings.push({ severity: 'high', code: 'SENSITIVE_CAPABILITY', message: 'Sensitive capabilities are never auto-approved.' });
    const requiresHuman = findings.some((item) => RISK_ORDER[item.severity] >= RISK_ORDER.high)
      || RISK_ORDER[risk] > RISK_ORDER[this.autoApproveThrough]
      || policy.requireHuman === true;
    const decision = requiresHuman ? 'human-review-required' : 'approved';
    return signed({
      schema: 'nolane.sovereign-capability-review.v1', requestId: request?.id ?? null, reviewerId: this.reviewerId, actorId: String(actorId ?? ''),
      capability, resource: request?.resource ?? null, scope: request?.scope ?? 'once', risk, decision,
      findings: deepFreeze(findings), policyReceiptSha256: request?.policyReceiptSha256 ?? null, createdAt: nowIso(this.clock),
      claims: deepFreeze({ independentReviewer: String(actorId ?? '') !== this.reviewerId, silentPrivilegeExpansion: false }),
    });
  }

  async reviewOutcome({ threadId, executorId, output, evidence = [], rules = [], metadata = {} } = {}) {
    const executor = required(executorId, 'executorId', 256);
    if (executor === this.reviewerId) throw Object.assign(new Error('reviewer and executor must be different identities'), { code: 'SOVEREIGN_REVIEW_NOT_INDEPENDENT' });
    const text = String(output ?? '').trim();
    if (!text) throw new TypeError('output is required for outcome review');
    if (Buffer.byteLength(text) > 5_000_000) throw new RangeError('outcome exceeds 5 MB');
    const findings = [];
    const normalizedEvidence = uniqueStrings((Array.isArray(evidence) ? evidence : []).map((item) => typeof item === 'string' ? item : item?.receiptSha256).filter(Boolean), { maxItems: 512, maxLength: 64 });
    if (!normalizedEvidence.length) findings.push({ severity: 'high', code: 'EVIDENCE_RECEIPT_MISSING', message: 'Non-mutating outcomes require at least one evidence receipt.', path: null, line: null, source: 'review-boundary' });
    for (const scanner of this.scanners) {
      const result = await scanner({ threadId, output: text, rules, metadata, mode: 'outcome' });
      for (const finding of result?.findings ?? result ?? []) findings.push({
        severity: String(finding?.severity ?? 'medium'), code: String(finding?.code ?? 'SCANNER_FINDING'), message: String(finding?.message ?? finding),
        path: finding?.path ?? null, line: finding?.line == null ? null : Number(finding.line), source: String(finding?.source ?? scanner.name ?? 'scanner'),
      });
    }
    const blocking = findings.filter((item) => ['high', 'critical'].includes(item.severity));
    return signed({
      schema: 'nolane.sovereign-outcome-review.v1', threadId: String(threadId ?? ''), executorId: executor, reviewerId: this.reviewerId,
      outputSha256: canonicalSha256(text), rulesSha256: canonicalSha256(uniqueStrings(rules, { maxItems: 256, maxLength: 2_000 })),
      evidenceReceiptSha256: normalizedEvidence, findings: deepFreeze(findings), decision: blocking.length ? 'changes-required' : 'approved', createdAt: nowIso(this.clock),
      claims: deepFreeze({ independentReviewer: true, mutationClaimed: false, hiddenReasoningStored: false }),
    });
  }

  async reviewChange({ threadId, executorId, diff, tests = [], evidence = [], rules = [], metadata = {} } = {}) {
    const executor = required(executorId, 'executorId', 256);
    if (executor === this.reviewerId) throw Object.assign(new Error('reviewer and executor must be different identities'), { code: 'SOVEREIGN_REVIEW_NOT_INDEPENDENT' });
    const fullDiff = String(diff ?? '');
    if (!fullDiff.trim()) throw new TypeError('diff is required for change review');
    if (Buffer.byteLength(fullDiff) > 5_000_000) throw new RangeError('diff exceeds 5 MB');
    const findings = [];
    for (const scanner of this.scanners) {
      const result = await scanner({ threadId, diff: fullDiff, rules, metadata });
      for (const finding of result?.findings ?? result ?? []) findings.push({
        severity: String(finding?.severity ?? 'medium'), code: String(finding?.code ?? 'SCANNER_FINDING'), message: String(finding?.message ?? finding),
        path: finding?.path ?? null, line: finding?.line == null ? null : Number(finding.line), source: String(finding?.source ?? scanner.name ?? 'scanner'),
      });
    }
    const normalizedTests = (Array.isArray(tests) ? tests : []).map((item) => ({
      name: String(item?.name ?? 'test'), status: String(item?.status ?? 'unknown'), receiptSha256: item?.receiptSha256 ?? null,
    }));
    if (!normalizedTests.length) findings.push({ severity: 'high', code: 'TEST_EVIDENCE_MISSING', message: 'No test receipt was supplied.', path: null, line: null, source: 'review-boundary' });
    if (normalizedTests.some((item) => item.status !== 'pass')) findings.push({ severity: 'high', code: 'TEST_FAILURE', message: 'At least one verification test did not pass.', path: null, line: null, source: 'review-boundary' });
    const normalizedEvidence = uniqueStrings((Array.isArray(evidence) ? evidence : []).map((item) => typeof item === 'string' ? item : item?.receiptSha256).filter(Boolean), { maxItems: 512, maxLength: 64 });
    if (!normalizedEvidence.length) findings.push({ severity: 'medium', code: 'EVIDENCE_RECEIPT_MISSING', message: 'No evidence receipt was supplied.', path: null, line: null, source: 'review-boundary' });
    const blocking = findings.filter((item) => ['high', 'critical'].includes(item.severity));
    const decision = blocking.length ? 'changes-required' : 'approved';
    const diffSha256 = canonicalSha256(fullDiff);
    return signed({
      schema: 'nolane.sovereign-change-review.v1', threadId: String(threadId ?? ''), executorId: executor, reviewerId: this.reviewerId,
      diffSha256, rulesSha256: canonicalSha256(uniqueStrings(rules, { maxItems: 256, maxLength: 2_000 })), tests: deepFreeze(normalizedTests),
      evidenceReceiptSha256: normalizedEvidence, findings: deepFreeze(findings), decision, createdAt: nowIso(this.clock),
      claims: deepFreeze({ independentReviewer: true, diffAppliedByReviewer: false, hiddenReasoningStored: false }),
    });
  }
}
