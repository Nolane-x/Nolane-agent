import { finite, signed, stringList, text } from './cognition-utils.mjs';

export class RecoveryLease {
  constructor({ leaseId, ttlMs = 60_000, clock = () => Date.now(), maxStrategies = 128 } = {}) {
    this.leaseId = text(leaseId, 'leaseId', 256);
    this.ttlMs = Math.max(1, Math.floor(finite(ttlMs, 'ttlMs', { min: 1 })));
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxStrategies = Math.max(1, Math.min(1_000, Math.floor(Number(maxStrategies) || 128)));
    this.startedAtMs = Number(this.clock());
    this.failures = new Map();
  }

  recordFailure(strategyFingerprint, receiptId) {
    const strategy = text(strategyFingerprint, 'strategyFingerprint', 512);
    const receipt = text(receiptId, 'receiptId', 512);
    this.failures.set(strategy, { receiptId: receipt, failedAtMs: Number(this.clock()) });
    while (this.failures.size > this.maxStrategies) this.failures.delete(this.failures.keys().next().value);
    return this.canUse(strategy);
  }

  canUse(strategyFingerprint) {
    const strategy = text(strategyFingerprint, 'strategyFingerprint', 512);
    const now = Number(this.clock());
    const expired = now - this.startedAtMs > this.ttlMs;
    const failure = this.failures.get(strategy);
    return signed({
      schema: 'forge.recovery-strategy-gate.v1', leaseId: this.leaseId, strategyFingerprint: strategy,
      allowed: expired || !failure, reason: expired || !failure ? null : 'strategy-failed-in-current-lease',
      leaseExpired: expired, failureReceiptId: failure?.receiptId ?? null,
    });
  }
}

export function evaluateCommitGate({ contextGate = {}, dominantHypothesis = null, minDominantProbability = 0.7, scope = {}, limits = {}, verificationProbeId = '', blockedInvariantIds = [] } = {}) {
  const reasons = [];
  if (contextGate.allowed !== true) reasons.push('context-posterior-dispersed');
  if (!dominantHypothesis || dominantHypothesis.status !== 'active') reasons.push('dominant-hypothesis-missing');
  else if (finite(dominantHypothesis.probability, 'dominantHypothesis.probability', { min: 0, max: 1 }) < minDominantProbability) reasons.push('dominant-hypothesis-weak');
  const files = Math.max(0, Math.floor(Number(scope.files) || 0));
  const changedLines = Math.max(0, Math.floor(Number(scope.changedLines) || 0));
  const maxFiles = Math.max(0, Math.floor(Number(limits.files) || 0));
  const maxChangedLines = Math.max(0, Math.floor(Number(limits.changedLines) || 0));
  if (maxFiles > 0 && files > maxFiles) reasons.push('scope-file-budget-exceeded');
  if (maxChangedLines > 0 && changedLines > maxChangedLines) reasons.push('scope-line-budget-exceeded');
  if (!String(verificationProbeId ?? '').trim()) reasons.push('verification-probe-unknown');
  const invariants = stringList(Array.isArray(blockedInvariantIds) ? blockedInvariantIds : [], 'blockedInvariantIds', { maxItems: 128, itemMax: 256 });
  if (invariants.length > 0) reasons.push('blocked-invariant');
  return signed({
    schema: 'forge.cognitive-commit-gate.v1', allowed: reasons.length === 0, reasons,
    dominantHypothesisId: dominantHypothesis?.id ?? null, verificationProbeId: String(verificationProbeId ?? '') || null,
    scope: { files, changedLines }, limits: { files: maxFiles, changedLines: maxChangedLines }, blockedInvariantIds: invariants,
  });
}

export function evaluateStopGate({ allCriteriaVerified = false, marginalInformationGain = 1, minInformationGain = 0.05, unresolvedCriticalRisks = 0 } = {}) {
  const informationGain = finite(marginalInformationGain, 'marginalInformationGain', { min: 0 });
  const threshold = finite(minInformationGain, 'minInformationGain', { min: 0 });
  const risks = Math.max(0, Math.floor(Number(unresolvedCriticalRisks) || 0));
  const criteriaComplete = allCriteriaVerified === true;
  const informationExhausted = informationGain < threshold;
  const stop = risks === 0 && (criteriaComplete || informationExhausted);
  return signed({
    schema: 'forge.cognitive-stop-gate.v1', stop,
    reason: !stop ? (risks > 0 ? 'critical-risks-unresolved' : 'information-gain-remains') : (criteriaComplete ? 'all-criteria-verified' : 'marginal-information-gain-low'),
    allCriteriaVerified: criteriaComplete, marginalInformationGain: informationGain, minInformationGain: threshold, unresolvedCriticalRisks: risks,
  });
}
