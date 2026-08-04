import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { signed, text } from '../construction/construction-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/i;
const EFFECT_DIMENSIONS = Object.freeze(['api', 'dependency', 'state', 'test', 'userVisible']);
function sha(value, label) { const output = String(value ?? '').toLowerCase(); if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`); return output; }
function finite(value, label) { const output = Number(value); if (!Number.isFinite(output)) throw new TypeError(`${label} must be finite`); return output; }
function unit(value, label) { const output = finite(value, label); if (output < 0 || output > 1) throw new TypeError(`${label} must be between 0 and 1`); return output; }
function effects(value = {}) { return Object.fromEntries(EFFECT_DIMENSIONS.map((key) => [key, finite(value[key] ?? 0, `effects.${key}`)])); }
function cited(items = []) {
  if (!Array.isArray(items) || !items.length) throw new TypeError('candidate citations are required');
  return items.map((item, index) => {
    if (!SHA256.test(String(item?.sourceHash ?? ''))) throw new TypeError(`citations[${index}].sourceHash must be SHA-256`);
    return { kind: text(item.kind, `citations[${index}].kind`, 128), sourceHash: String(item.sourceHash).toLowerCase() };
  });
}

export class CounterfactualChangeRuntime {
  constructor() {
    this.imaginations = new Map();
    this.verifications = new Map();
    this.executions = new Map();
  }

  imagine({ changeId, baselineCandidateId, candidates = [] } = {}) {
    const id = text(changeId, 'changeId', 256); const baselineId = text(baselineCandidateId, 'baselineCandidateId', 256);
    if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 8) throw new TypeError('candidates must contain 2-8 items');
    const seen = new Set();
    const normalized = candidates.map((candidate, index) => {
      const candidateId = text(candidate.candidateId, `candidates[${index}].candidateId`, 256);
      if (seen.has(candidateId)) throw new TypeError(`duplicate candidateId: ${candidateId}`); seen.add(candidateId);
      return {
        candidateId, reliability: unit(candidate.reliability, `candidates[${index}].reliability`),
        effects: effects(candidate.effects), utility: finite(candidate.utility, `candidates[${index}].utility`), citations: cited(candidate.citations),
      };
    });
    if (!seen.has(baselineId)) throw new Error('baseline candidate is missing');
    normalized.sort((a, b) => (b.utility * b.reliability) - (a.utility * a.reliability) || a.candidateId.localeCompare(b.candidateId));
    const selected = normalized[0];
    const base = {
      schema: 'forge.counterfactual-change.v1', phase: 'imagine', changeId: id, baselineCandidateId: baselineId,
      selectedCandidateId: selected.candidateId, candidates: normalized,
      effectDimensions: selected.effects,
      predictedUtilityDelta: selected.utility - normalized.find((item) => item.candidateId === baselineId).utility,
      claims: { observedEvidence: false, patchApplied: false, simulationIsProductionEvidence: false },
    };
    const receipt = signed(base); this.imaginations.set(receipt.receiptSha256, receipt); return receipt;
  }

  verify(imaginationReceiptSha256, { observedReceiptSha256, observedEffects, status } = {}) {
    const imaginationReceipt = sha(imaginationReceiptSha256, 'imaginationReceiptSha256');
    const imagination = this.imaginations.get(imaginationReceipt);
    if (!imagination) throw new Error('unknown imagination receipt');
    const observedReceipt = sha(observedReceiptSha256, 'observedReceiptSha256');
    const verificationStatus = text(status, 'status', 64);
    if (!['pass', 'fail'].includes(verificationStatus)) throw new TypeError('status must be pass or fail');
    const observed = effects(observedEffects);
    const selected = imagination.candidates.find((candidate) => candidate.candidateId === imagination.selectedCandidateId);
    const absoluteError = Object.fromEntries(EFFECT_DIMENSIONS.map((key) => [key, Math.abs(selected.effects[key] - observed[key])]));
    const receipt = signed({
      schema: 'forge.counterfactual-change.v1', phase: 'verify', changeId: imagination.changeId,
      imaginationReceiptSha256: imagination.receiptSha256, selectedCandidateId: imagination.selectedCandidateId,
      status: verificationStatus, observedReceiptSha256: observedReceipt, observedEffects: observed, absoluteError,
      claims: { observedEvidence: true, patchApplied: false },
    });
    this.verifications.set(receipt.receiptSha256, { receipt, imagination }); return receipt;
  }

  async execute(verificationReceiptSha256, { executionReceiptSha256, apply } = {}) {
    const verificationReceipt = sha(verificationReceiptSha256, 'verificationReceiptSha256');
    const record = this.verifications.get(verificationReceipt);
    if (!record || record.receipt.status !== 'pass') throw new Error('verified counterfactual receipt is required before execute');
    if (typeof apply !== 'function') throw new TypeError('apply is required');
    const requestedExecutionReceipt = sha(executionReceiptSha256, 'executionReceiptSha256');
    const applied = await apply({ candidateId: record.receipt.selectedCandidateId, changeId: record.receipt.changeId, verificationReceiptSha256: verificationReceipt });
    if (!applied || applied.status !== 'pass') throw new Error('counterfactual execution failed');
    const appliedReceipt = sha(applied.receiptSha256, 'apply.receiptSha256');
    const receipt = signed({
      schema: 'forge.counterfactual-change.v1', phase: 'execute', changeId: record.receipt.changeId, status: 'pass',
      selectedCandidateId: record.receipt.selectedCandidateId, verificationReceiptSha256: verificationReceipt,
      executionReceiptSha256: requestedExecutionReceipt, applyReceiptSha256: appliedReceipt,
      claims: { executeWithoutVerifyAllowed: false, observedVerificationRequired: true },
    });
    this.executions.set(receipt.receiptSha256, { receipt, verification: record.receipt, imagination: record.imagination }); return receipt;
  }

  recordOutcome(executionReceiptSha256, { observedUtility, baselineObservedUtility, observedReceiptSha256 } = {}) {
    const executionReceipt = sha(executionReceiptSha256, 'executionReceiptSha256');
    const record = this.executions.get(executionReceipt);
    if (!record) throw new Error('unknown execution receipt');
    const observed = finite(observedUtility, 'observedUtility'); const baseline = finite(baselineObservedUtility, 'baselineObservedUtility');
    const delta = observed - baseline;
    const impact = delta > 0 ? 'improved' : delta < 0 ? 'worsened' : 'neutral';
    const receipt = signed({
      schema: 'forge.counterfactual-decision-outcome.v1', executionReceiptSha256: executionReceipt,
      observedReceiptSha256: sha(observedReceiptSha256, 'observedReceiptSha256'), observedUtility: observed,
      baselineObservedUtility: baseline, observedUtilityDelta: delta, decisionImpact: impact,
      predictedUtilityDelta: record.imagination.predictedUtilityDelta,
      predictionError: Math.abs(record.imagination.predictedUtilityDelta - delta),
      claims: { simulationAlwaysHelpful: false, worseningMeasured: true },
    });
    return receipt;
  }
}
