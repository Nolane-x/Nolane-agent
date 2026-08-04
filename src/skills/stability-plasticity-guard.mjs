import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH = /^[a-f0-9]{64}$/i;
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function finite(value) { const n = Number(value ?? 0); if (!Number.isFinite(n)) throw new TypeError('metric must be finite'); return n; }
function bounded(value) { return Math.max(0, Math.min(1, finite(value))); }
function required(value, label) { const out = String(value ?? '').trim(); if (!out) throw new TypeError(`${label} is required`); return out; }
function requiredHash(value, label) { const out = String(value ?? ''); if (!HASH.test(out)) throw new TypeError(`${label} must be a SHA-256 hash`); return out.toLowerCase(); }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class StabilityPlasticityGuard {
  constructor({ maxBackwardLoss = 0.05, maxNegativeTransfer = 0.05, maxMemoryGrowthRatio = 0.30, minLateTaskLearning = -0.05 } = {}) {
    this.maxBackwardLoss = Math.max(0, Number(maxBackwardLoss) || 0.05);
    this.maxNegativeTransfer = Math.max(0, Number(maxNegativeTransfer) || 0.05);
    this.maxMemoryGrowthRatio = Math.max(0, Number(maxMemoryGrowthRatio) || 0.30);
    this.minLateTaskLearning = Number(minLateTaskLearning ?? -0.05);
  }

  evaluate(input = {}) {
    const candidateSkillId = required(input.candidateSkillId, 'candidateSkillId');
    if (!Array.isArray(input.policyLineage) || input.policyLineage.length < 2) throw new TypeError('policy lineage with baseline and candidate is required');
    if (!input.rollbackTarget?.policyId) throw new TypeError('rollback target is required');
    const rollbackReceipt = requiredHash(input.rollbackTarget.receiptSha256, 'rollback receipt');
    const verificationReceiptSha256 = requiredHash(input.verificationReceiptSha256, 'verification receipt');
    const baseline = input.baseline ?? {}; const candidate = input.candidate ?? {};
    const oldBaseline = bounded(baseline.oldTaskSuccess); const oldCandidate = bounded(candidate.oldTaskSuccess);
    const newBaseline = bounded(baseline.newTaskSuccess); const newCandidate = bounded(candidate.newTaskSuccess);
    const lateBaseline = bounded(baseline.lateTaskSuccess); const lateCandidate = bounded(candidate.lateTaskSuccess);
    const baselineMemory = Math.max(1, finite(baseline.memoryItems)); const candidateMemory = Math.max(0, finite(candidate.memoryItems));
    const forwardTransfer = newCandidate - newBaseline;
    const backwardTransfer = oldCandidate - oldBaseline;
    const negativeTransfer = Math.max(0, newBaseline - newCandidate);
    const lateTaskLearning = lateCandidate - lateBaseline;
    const memoryGrowthRatio = (candidateMemory - baselineMemory) / baselineMemory;
    const reasons = [];
    if (String(input.candidateState) !== 'transfer-tested') reasons.push('candidate skill is not transfer-tested');
    if (backwardTransfer < -this.maxBackwardLoss) reasons.push(`backward transfer regression ${backwardTransfer.toFixed(4)}`);
    if (negativeTransfer > this.maxNegativeTransfer) reasons.push(`negative transfer ${negativeTransfer.toFixed(4)}`);
    if (lateTaskLearning < this.minLateTaskLearning) reasons.push(`late-task learning regression ${lateTaskLearning.toFixed(4)}`);
    if (memoryGrowthRatio > this.maxMemoryGrowthRatio) reasons.push(`memory growth ratio ${memoryGrowthRatio.toFixed(4)} exceeds budget`);
    if (input.exceptionRetention !== true) reasons.push('schema exception retention failed');
    if (input.sourceTaskOnly === true) reasons.push('candidate succeeds only on its source task');
    const metrics = freeze({ forwardTransfer, backwardTransfer, negativeTransfer, lateTaskLearning, memoryGrowthRatio, baselineMemoryItems: baselineMemory, candidateMemoryItems: candidateMemory });
    return signed({ schema: 'forge.stability-plasticity-decision.v1', candidateSkillId, promotable: reasons.length === 0, reasons: freeze(reasons), metrics, policyLineage: freeze(input.policyLineage.map(String)), rollbackTarget: freeze({ policyId: String(input.rollbackTarget.policyId), receiptSha256: rollbackReceipt }), verificationReceiptSha256, claims: { automaticPromotionExecuted: false, hiddenReasoningStored: false } });
  }
}
