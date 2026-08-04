import { boundedNumber, signed, strings, text } from './construction-utils.mjs';

export function buildCompletionProof(input = {}) {
  const criteria = Array.isArray(input.criteria) ? input.criteria.map((item, index) => ({ criterionId: text(item.criterionId, `criteria[${index}].criterionId`, 256), complete: item.complete === true, receiptSha256: item.receiptSha256 ? String(item.receiptSha256) : null })) : [];
  const verificationReceiptIds = strings(input.verificationReceiptIds ?? [], 'verificationReceiptIds', 5_000, 512);
  const requireSemanticCompletion = input.requireSemanticCompletion === true;
  const semanticCompletionDecision = input.semanticCompletionDecision ? {
    status: String(input.semanticCompletionDecision.status ?? '').trim() || null,
    completionAllowed: input.semanticCompletionDecision.completionAllowed === true,
    receiptSha256: input.semanticCompletionDecision.receiptSha256 ? String(input.semanticCompletionDecision.receiptSha256) : null,
  } : null;
  const trajectoryConfidence = input.trajectoryConfidence ? {
    finalConfidence: boundedNumber(input.trajectoryConfidence.finalConfidence, 0, 0, 1, 'trajectoryConfidence.finalConfidence'),
    receiptSha256: input.trajectoryConfidence.receiptSha256 ? String(input.trajectoryConfidence.receiptSha256) : null,
  } : null;
  const testIntegrityReceiptSha256 = input.testIntegrityReceiptSha256 ? String(input.testIntegrityReceiptSha256) : null;
  const apiDecisionReceiptIds = strings(input.apiDecisionReceiptIds ?? [], 'apiDecisionReceiptIds', 5_000, 512);
  const independentReviewReceiptSha256 = input.independentReviewReceiptSha256 ? String(input.independentReviewReceiptSha256) : null;
  const failureProofReceiptIds = strings(input.failureProofReceiptIds ?? [], 'failureProofReceiptIds', 5_000, 512);

  const missingEvidence = [];
  if (!criteria.length || criteria.some((item) => !item.complete || !item.receiptSha256)) missingEvidence.push('acceptance-criteria');
  if (!input.traceabilityReceiptSha256) missingEvidence.push('traceability-receipt');
  if (!input.invariantVerification?.allowed || !input.invariantVerification?.receiptSha256 || input.invariantVerification?.blockingInvariantIds?.length) missingEvidence.push('invariant-verification');
  if (!verificationReceiptIds.length) missingEvidence.push('verification-receipts');
  if (!String(input.rollbackPoint ?? '').trim()) missingEvidence.push('rollback-point');
  if (requireSemanticCompletion) {
    const semanticComplete = semanticCompletionDecision?.status === 'pass'
      && semanticCompletionDecision?.completionAllowed === true
      && Boolean(semanticCompletionDecision?.receiptSha256)
      && Boolean(trajectoryConfidence?.receiptSha256)
      && Number.isFinite(trajectoryConfidence?.finalConfidence)
      && Boolean(testIntegrityReceiptSha256)
      && apiDecisionReceiptIds.length > 0
      && Boolean(independentReviewReceiptSha256);
    if (!semanticComplete) missingEvidence.push('semantic-completion');
  }

  return signed({
    schema: 'forge.completion-proof-bundle.v1', missionId: text(input.missionId, 'missionId', 256), specificationId: text(input.specificationId, 'specificationId', 256),
    status: missingEvidence.length ? 'incomplete' : 'complete', missingEvidence, criteria,
    traceabilityReceiptSha256: input.traceabilityReceiptSha256 ? String(input.traceabilityReceiptSha256) : null,
    invariantVerification: input.invariantVerification ? { allowed: input.invariantVerification.allowed === true, receiptSha256: input.invariantVerification.receiptSha256 ? String(input.invariantVerification.receiptSha256) : null, blockingInvariantIds: strings(input.invariantVerification.blockingInvariantIds ?? [], 'blockingInvariantIds', 512, 256) } : null,
    changedSymbols: strings(input.changedSymbols ?? [], 'changedSymbols', 10_000, 512), semanticFootprint: boundedNumber(input.semanticFootprint, 0, 0, 1_000_000, 'semanticFootprint'),
    decisionReceiptIds: strings(input.decisionReceiptIds ?? [], 'decisionReceiptIds', 5_000, 512), verificationReceiptIds,
    requireSemanticCompletion, semanticCompletionDecision, trajectoryConfidence, testIntegrityReceiptSha256, apiDecisionReceiptIds, independentReviewReceiptSha256, failureProofReceiptIds,
    residualRisks: strings(input.residualRisks ?? [], 'residualRisks', 1_000, 2_048), limitations: strings(input.limitations ?? [], 'limitations', 1_000, 2_048),
    rollbackPoint: String(input.rollbackPoint ?? '').trim() || null,
    claims: { privateReasoningStored: false, completionClaimAllowed: missingEvidence.length === 0, benchmarkSuperiorityClaimed: false },
  });
}
