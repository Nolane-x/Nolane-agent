import { boundedNumber, signed, strings, text } from '../construction/construction-utils.mjs';

const HASH = /^[a-f0-9]{64}$/i;
function hash(value, label, required = true) {
  const out = String(value ?? '').toLowerCase();
  if (!out && !required) return null;
  if (!HASH.test(out)) throw new TypeError(`${label} must be SHA-256`);
  return out;
}

export class SemanticCompletionGate {
  constructor({ minimumConfidence = 0.6 } = {}) {
    this.minimumConfidence = boundedNumber(minimumConfidence, 0.6, 0, 1, 'minimumConfidence');
  }

  decide({ pyramidPlan = null, criteria = [], stageReceipts = [], testIntegrity = null, apiDecisions = [], reviewDecision = null, failureProofs = [], trajectory = null, residualRisks = [], rollbackPoint = null } = {}) {
    if (!Array.isArray(criteria) || !Array.isArray(stageReceipts) || !Array.isArray(apiDecisions) || !Array.isArray(failureProofs) || !Array.isArray(residualRisks)) throw new TypeError('completion evidence arrays are required');
    const reasons = [];
    const missing = [];
    const normalizedCriteria = criteria.map((item, index) => {
      const criterionId = text(item?.criterionId, `criteria[${index}].criterionId`, 512);
      const complete = item?.complete === true;
      const receiptSha256 = hash(item?.receiptSha256, `criteria[${index}].receiptSha256`, false);
      if (!complete || !receiptSha256) missing.push(`criterion-incomplete:${criterionId}`);
      return Object.freeze({ criterionId, complete, receiptSha256 });
    });
    if (!normalizedCriteria.length) missing.push('acceptance-criteria-missing');

    const normalizedStages = stageReceipts.map((item, index) => Object.freeze({ kind: text(item?.kind, `stageReceipts[${index}].kind`, 128), status: text(item?.status, `stageReceipts[${index}].status`, 32), receiptSha256: hash(item?.receiptSha256, `stageReceipts[${index}].receiptSha256`) }));
    if (pyramidPlan?.stages) {
      for (const required of pyramidPlan.stages) {
        const evidence = normalizedStages.find((item) => item.kind === required.kind && item.status === 'pass');
        if (!evidence) missing.push(`verification-stage-missing:${required.kind}`);
      }
    }

    if (!testIntegrity?.receiptSha256) missing.push('test-integrity-evidence-missing');
    else {
      hash(testIntegrity.receiptSha256, 'testIntegrity.receiptSha256');
      if (testIntegrity.allowedAsCompletionEvidence !== true || Number(testIntegrity.blockingFindings ?? 0) > 0) reasons.push('test-integrity-blocked');
    }

    const normalizedApi = apiDecisions.map((item, index) => {
      const receiptSha256 = hash(item?.receiptSha256, `apiDecisions[${index}].receiptSha256`);
      if (item?.allowed !== true || item?.status !== 'pass') reasons.push('api-existence-blocked');
      return Object.freeze({ allowed: item?.allowed === true, status: String(item?.status ?? ''), receiptSha256 });
    });

    let normalizedReview = null;
    if (reviewDecision) {
      normalizedReview = Object.freeze({ status: String(reviewDecision.status ?? ''), unresolvedFindingFingerprints: strings(reviewDecision.unresolvedFindingFingerprints ?? [], 'reviewDecision.unresolvedFindingFingerprints', 1_000, 128), receiptSha256: hash(reviewDecision.receiptSha256, 'reviewDecision.receiptSha256') });
      if (normalizedReview.status !== 'pass' || normalizedReview.unresolvedFindingFingerprints.length) reasons.push('independent-review-unresolved');
    }

    const normalizedFailures = failureProofs.map((item, index) => {
      const normalized = Object.freeze({ faultType: String(item?.faultType ?? ''), status: String(item?.status ?? ''), receiptSha256: hash(item?.receiptSha256, `failureProofs[${index}].receiptSha256`) });
      if (normalized.status !== 'pass') reasons.push('failure-recovery-unproven');
      return normalized;
    });

    let normalizedTrajectory = null;
    if (!trajectory?.receiptSha256) missing.push('trajectory-confidence-missing');
    else {
      normalizedTrajectory = Object.freeze({ finalConfidence: boundedNumber(trajectory.finalConfidence, 0, 0, 1, 'trajectory.finalConfidence'), weakestCritical: trajectory.weakestCritical ? { kind: String(trajectory.weakestCritical.kind ?? ''), confidence: Number(trajectory.weakestCritical.confidence ?? 0) } : null, receiptSha256: hash(trajectory.receiptSha256, 'trajectory.receiptSha256') });
      if (normalizedTrajectory.finalConfidence < this.minimumConfidence) reasons.push('trajectory-confidence-below-threshold');
    }

    const normalizedRisks = residualRisks.slice(0, 1_000).map((risk) => typeof risk === 'string' ? Object.freeze({ description: risk.slice(0, 2_000), severity: 'medium', resolved: false }) : Object.freeze({ description: String(risk?.description ?? risk?.id ?? 'risk').slice(0, 2_000), severity: String(risk?.severity ?? 'medium'), resolved: risk?.resolved === true }));
    if (normalizedRisks.some((risk) => ['high', 'critical'].includes(risk.severity) && !risk.resolved)) reasons.push('critical-residual-risk');
    const rollback = String(rollbackPoint ?? '').trim();
    if (!rollback) missing.push('rollback-point-missing');

    const uniqueReasons = [...new Set(reasons)];
    const uniqueMissing = [...new Set(missing)];
    const status = uniqueReasons.length ? 'blocked' : uniqueMissing.length ? 'incomplete' : 'pass';
    return signed({
      schema: 'forge.semantic-completion-decision.v1',
      status,
      completionAllowed: status === 'pass',
      reasons: uniqueReasons,
      missingEvidence: uniqueMissing,
      minimumConfidence: this.minimumConfidence,
      criteria: normalizedCriteria,
      stageReceipts: normalizedStages,
      testIntegrityReceiptSha256: testIntegrity?.receiptSha256 ?? null,
      apiDecisions: normalizedApi,
      reviewDecision: normalizedReview,
      failureProofs: normalizedFailures,
      trajectory: normalizedTrajectory,
      residualRisks: normalizedRisks,
      rollbackPoint: rollback || null,
      claims: { greenSuiteAloneSufficient: false, acceptanceClickAloneSufficient: false, privateReasoningStored: false },
    });
  }
}
