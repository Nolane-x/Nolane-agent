import { canonicalSha256, deepFreeze } from './shared.mjs';
import { loadModelArtifact } from './model-artifact.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
export class ModelArtifactRegistry {
  #artifacts = new Map(); #history = new Map(); #receipts = []; #rollbacks = 0;
  register(artifact) {
    const value = loadModelArtifact(artifact);
    const existing = this.#artifacts.get(value.artifactSha256);
    if (existing) return existing;
    this.#artifacts.set(value.artifactSha256, value); return value;
  }
  promote({ artifactSha256, evaluation, approvedBy } = {}) {
    const artifact = this.#artifacts.get(String(artifactSha256)); if (!artifact) throw new Error('Unknown model artifact');
    const approval = String(approvedBy ?? '').trim(); if (!approval) throw new Error('Explicit user approval is required');
    if (!evaluation || evaluation.schema !== 'nolane.small-model.specialist-evaluation.v1' || evaluation.allowed !== true || evaluation.independent !== true || evaluation.heldOut !== true || !SHA256.test(String(evaluation.receiptSha256 ?? ''))) throw new Error('Allowed evaluation receipt is required');
    if (evaluation.artifactSha256 !== artifact.artifactSha256) throw new Error('Evaluation artifact mismatch');
    if (Number(evaluation.safetyViolations) > Number(evaluation.baselineSafetyViolations)) throw new Error('Evaluation safety is worse than baseline');
    const history = this.#history.get(artifact.specialist) ?? [];
    if (history.at(-1)?.artifactSha256 === artifact.artifactSha256) return history.at(-1).receipt;
    const base = { schema: 'nolane.small-model.artifact-promotion.v1', specialist: artifact.specialist, artifactSha256: artifact.artifactSha256, previousArtifactSha256: history.at(-1)?.artifactSha256 ?? null, evaluationReceiptSha256: evaluation.receiptSha256, approvedBy: approval, status: 'promoted' };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    history.push({ artifactSha256: artifact.artifactSha256, receipt }); this.#history.set(artifact.specialist, history); this.#receipts.push(receipt); return receipt;
  }
  promoteWithAblation({ artifactSha256, evaluation, ablation, approvedBy } = {}) {
    const artifact = this.#artifacts.get(String(artifactSha256)); if (!artifact) throw new Error('Unknown model artifact');
    const approval = String(approvedBy ?? '').trim(); if (!approval) throw new Error('Explicit user approval is required');
    if (!evaluation || evaluation.schema !== 'nolane.small-model.specialist-evaluation.v1' || evaluation.allowed !== true || evaluation.independent !== true || evaluation.heldOut !== true || !SHA256.test(String(evaluation.receiptSha256 ?? ''))) throw new Error('Allowed evaluation receipt is required');
    if (evaluation.artifactSha256 !== artifact.artifactSha256) throw new Error('Evaluation artifact mismatch');
    if (!ablation || ablation.schema !== 'nolane.small-model.checkpoint-6-ablation.v1' || ablation.allowed !== true || !SHA256.test(String(ablation.receiptSha256 ?? ''))) throw new Error('Allowed ablation receipt is required');
    const { receiptSha256: ablationHash, ...ablationBase } = ablation;
    if (canonicalSha256(ablationBase) !== ablationHash) throw new Error('Ablation receipt hash mismatch');
    if (ablation.artifactSha256 !== artifact.artifactSha256 || ablation.model?.artifactSha256 !== artifact.artifactSha256) throw new Error('Ablation artifact mismatch');
    if (Number(ablation.lift) < Number(ablation.thresholds?.minLift ?? 0.1)) throw new Error('Ablation lift is insufficient');
    if (Number(ablation.model?.safetyViolations) > Number(ablation.baselineEvaluation?.safetyViolations)) throw new Error('Ablation safety is worse than baseline');
    const history = this.#history.get(artifact.specialist) ?? [];
    if (history.at(-1)?.artifactSha256 === artifact.artifactSha256 && history.at(-1)?.receipt?.schema === 'nolane.small-model.artifact-promotion.v2') return history.at(-1).receipt;
    const base = { schema: 'nolane.small-model.artifact-promotion.v2', specialist: artifact.specialist, artifactSha256: artifact.artifactSha256, previousArtifactSha256: history.at(-1)?.artifactSha256 ?? null, evaluationReceiptSha256: evaluation.receiptSha256, ablationReceiptSha256: ablation.receiptSha256, approvedBy: approval, status: 'promoted', governance: 'ablation-required' };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    history.push({ artifactSha256: artifact.artifactSha256, receipt }); this.#history.set(artifact.specialist, history); this.#receipts.push(receipt); return receipt;
  }

  promoteWithTransferEvidence({ artifactSha256, evaluation, ablation, evidenceBundle, approvedBy } = {}) {
    const artifact = this.#artifacts.get(String(artifactSha256)); if (!artifact) throw new Error('Unknown model artifact');
    const approval = String(approvedBy ?? '').trim(); if (!approval) throw new Error('Explicit user approval is required');
    if (!evaluation || evaluation.schema !== 'nolane.small-model.specialist-evaluation.v1' || evaluation.allowed !== true || evaluation.independent !== true || evaluation.heldOut !== true || !SHA256.test(String(evaluation.receiptSha256 ?? ''))) throw new Error('Allowed evaluation receipt is required');
    if (evaluation.artifactSha256 !== artifact.artifactSha256) throw new Error('Evaluation artifact mismatch');
    if (!ablation || ablation.schema !== 'nolane.small-model.checkpoint-6-ablation.v1' || ablation.allowed !== true || !SHA256.test(String(ablation.receiptSha256 ?? ''))) throw new Error('Allowed ablation receipt is required');
    const verify = (value, label) => {
      if (!value || !SHA256.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
      const { receiptSha256, ...base } = value;
      if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
      return value;
    };
    verify(ablation, 'Ablation');
    if (ablation.artifactSha256 !== artifact.artifactSha256 || ablation.model?.artifactSha256 !== artifact.artifactSha256) throw new Error('Ablation artifact mismatch');
    const bundle = verify(evidenceBundle, 'Checkpoint 7 evidence bundle');
    if (bundle.schema !== 'nolane.small-model.checkpoint-7-evidence-bundle.v1') throw new Error('Checkpoint 7 evidence bundle is required');
    if (bundle.artifactSha256 !== artifact.artifactSha256) throw new Error('Checkpoint 7 evidence artifact mismatch');
    if (bundle.evaluationReceiptSha256 !== evaluation.receiptSha256 || bundle.ablationReceiptSha256 !== ablation.receiptSha256) throw new Error('Checkpoint 7 evidence lineage mismatch');
    const transfer = verify(bundle.transfer, 'Checkpoint 7 transfer');
    const process = verify(bundle.process, 'Checkpoint 7 process');
    const cost = verify(bundle.cost, 'Checkpoint 7 cost');
    if (transfer.schema !== 'nolane.small-model.checkpoint-7-transfer-evidence.v1' || transfer.allowed !== true || transfer.repositoryDisjoint !== true || Number(transfer.candidateSuccessRate) <= Number(transfer.baselineSuccessRate)) throw new Error('Checkpoint 7 transfer evidence must be repository-disjoint and positive');
    if (process.schema !== 'nolane.small-model.checkpoint-7-process-evidence.v1' || process.allowed !== true || Number(process.delta) <= 0) throw new Error('Checkpoint 7 process delta must be positive');
    if (cost.schema !== 'nolane.small-model.checkpoint-7-cost-evidence.v1' || cost.allowed !== true || cost.candidateCostLower !== true || !(Number(cost.totalCostRatio) < 1)) throw new Error('Checkpoint 7 cost evidence must show lower matched-quality cost');
    if (transfer.artifactSha256 !== artifact.artifactSha256 || process.artifactSha256 !== artifact.artifactSha256 || cost.artifactSha256 !== artifact.artifactSha256) throw new Error('Checkpoint 7 nested artifact mismatch');
    if (bundle.safety?.noRegression !== true || Number(bundle.safety.candidateViolations) > Number(bundle.safety.baselineViolations)) throw new Error('Checkpoint 7 safety is worse than baseline');
    if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false) throw new Error('Checkpoint 7 non-claims must remain locked');
    const history = this.#history.get(artifact.specialist) ?? [];
    if (history.at(-1)?.artifactSha256 === artifact.artifactSha256 && history.at(-1)?.receipt?.schema === 'nolane.small-model.artifact-promotion.v3') return history.at(-1).receipt;
    const base = { schema: 'nolane.small-model.artifact-promotion.v3', specialist: artifact.specialist, artifactSha256: artifact.artifactSha256, previousArtifactSha256: history.at(-1)?.artifactSha256 ?? null, evaluationReceiptSha256: evaluation.receiptSha256, ablationReceiptSha256: ablation.receiptSha256, evidenceBundleReceiptSha256: bundle.receiptSha256, transferReceiptSha256: transfer.receiptSha256, processReceiptSha256: process.receiptSha256, costReceiptSha256: cost.receiptSha256, approvedBy: approval, status: 'promoted', governance: 'transfer-process-cost-required' };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    history.push({ artifactSha256: artifact.artifactSha256, receipt }); this.#history.set(artifact.specialist, history); this.#receipts.push(receipt); return receipt;
  }
  get(artifactSha256) { return this.#artifacts.get(String(artifactSha256)) ?? null; }
  active(specialist) { const record = (this.#history.get(String(specialist)) ?? []).at(-1); return record ? this.#artifacts.get(record.artifactSha256) : null; }
  activeAblationEligible(specialist) { const record = (this.#history.get(String(specialist)) ?? []).at(-1); return ['nolane.small-model.artifact-promotion.v2','nolane.small-model.artifact-promotion.v3'].includes(record?.receipt?.schema) ? this.#artifacts.get(record.artifactSha256) : null; }
  activeTransferEligible(specialist) { const record = (this.#history.get(String(specialist)) ?? []).at(-1); return record?.receipt?.schema === 'nolane.small-model.artifact-promotion.v3' && record.receipt.governance === 'transfer-process-cost-required' ? this.#artifacts.get(record.artifactSha256) : null; }
  activePromotion(specialist) { return (this.#history.get(String(specialist)) ?? []).at(-1)?.receipt ?? null; }
  rollback(specialist, { approvedBy } = {}) {
    const approval = String(approvedBy ?? '').trim(); if (!approval) throw new Error('Explicit user approval is required for rollback');
    const key = String(specialist); const history = this.#history.get(key) ?? []; if (history.length < 2) throw new Error(`No rollback artifact for ${key}`);
    const removed = history.pop(); this.#history.set(key, history); this.#rollbacks += 1;
    const active = this.#artifacts.get(history.at(-1).artifactSha256);
    const base = { schema: 'nolane.small-model.artifact-rollback.v1', specialist: key, removedArtifactSha256: removed.artifactSha256, artifactSha256: active.artifactSha256, approvedBy: approval };
    return deepFreeze({ ...active, rollbackReceiptSha256: canonicalSha256(base) });
  }
  snapshot() { return deepFreeze({ schema: 'nolane.small-model.artifact-registry.v1', artifacts: this.#artifacts.size, specialists: this.#history.size, promotions: this.#receipts.length, rollbacks: this.#rollbacks, active: Object.fromEntries([...this.#history].map(([key, history]) => [key, history.at(-1)?.artifactSha256 ?? null])) }); }
}
