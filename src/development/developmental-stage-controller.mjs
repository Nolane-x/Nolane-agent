import { boundedArray, finite, signed, text, unit } from '../world-model/world-model-utils.mjs';
function validReceipt(value) { return /^[a-f0-9]{64}$/i.test(String(value ?? '')); }
export class DevelopmentalStageController {
  constructor({ stages = [] } = {}) { this.stages = boundedArray(stages, 32).map((stage) => ({ id: text(stage.id, 'stage.id', 128), autonomyCeiling: unit(stage.autonomyCeiling), exploration: unit(stage.exploration), replayRate: unit(stage.replayRate), memoryThreshold: unit(stage.memoryThreshold), promoteRate: unit(stage.promoteRate) })); if (!this.stages.length) this.stages = [{ id: 'observe', autonomyCeiling: 0.1, exploration: 0.05, replayRate: 0.2, memoryThreshold: 0.85, promoteRate: 0 }]; this.currentStageId = this.stages[0].id; }
  evaluateAdvance(input = {}) {
    const from = text(input.from, 'from', 128); const to = text(input.to, 'to', 128); const fromIndex = this.stages.findIndex((s) => s.id === from); const toIndex = this.stages.findIndex((s) => s.id === to); const reasons = [];
    if (fromIndex < 0 || toIndex !== fromIndex + 1) reasons.push('invalid-stage-transition');
    if (input.heldOutTransfer?.passed !== true || !validReceipt(input.heldOutTransfer?.receiptSha256)) reasons.push('held-out-transfer-required');
    if (input.regression?.passed !== true || !validReceipt(input.regression?.receiptSha256)) reasons.push('regression-suite-required');
    if (input.futureSelf?.viable !== true || !validReceipt(input.futureSelf?.receiptSha256)) reasons.push('future-self-viability-required');
    if (input.humanPolicyGate?.approved !== true || !validReceipt(input.humanPolicyGate?.receiptSha256)) reasons.push('human-policy-gate-required');
    const allowed = reasons.length === 0; if (allowed) this.currentStageId = to;
    return signed({ schema: 'forge.developmental-stage-decision.v1', from, to, allowed, reasons, autonomyCeiling: this.stages[toIndex]?.autonomyCeiling ?? 0, claims: { autonomousStageAdvanceAllowed: false } });
  }
  evaluatePolicyUpdate(input = {}) {
    const stage = this.stages.find((item) => item.id === text(input.stageId, 'stageId', 128)); if (!stage) throw new RangeError('unknown developmental stage'); const reasons = [];
    if (input.heldOutTransfer?.passed !== true || !validReceipt(input.heldOutTransfer?.receiptSha256)) reasons.push('held-out-transfer-required');
    if (!validReceipt(input.rollbackReceiptSha256)) reasons.push('rollback-lineage-required');
    if (!validReceipt(input.futureSelf?.receiptSha256)) reasons.push('future-self-simulation-required');
    if (finite(input.futureSelf?.backwardTransfer) < -0.05 || finite(input.futureSelf?.negativeTransfer) > 0.1 || finite(input.futureSelf?.resourceGrowth) > 0.25) reasons.push('future-self-regression');
    const proposed = { exploration: unit(input.proposed?.exploration), replayRate: unit(input.proposed?.replayRate), memoryThreshold: unit(input.proposed?.memoryThreshold), promoteRate: unit(input.proposed?.promoteRate) };
    if (proposed.exploration > stage.autonomyCeiling || proposed.promoteRate > 0.1) reasons.push('autonomy-ceiling-exceeded');
    return signed({ schema: 'forge.developmental-policy-update.v1', stageId: stage.id, allowed: false, shadowEligible: reasons.length === 0, reasons, proposed, claims: { productionPolicyPromotionAllowed: false, automaticCoreRewriteAllowed: false } });
  }
  snapshot() { return signed({ schema: 'forge.developmental-stage-snapshot.v1', currentStageId: this.currentStageId, stages: this.stages.map((item) => ({ ...item })), claims: { productionPolicyPromotionAllowed: false, automaticCoreRewriteAllowed: false, heldOutTransferRequired: true } }); }
}
