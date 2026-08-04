import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function verifyReceipt(value, label) {
  if (!value || !SHA256.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}

function verifySkill(skill) {
  verifyReceipt(skill, 'Skill');
  if (!['nolane.small-model.ast-skill.v2', 'nolane.small-model.constraint-skill.v1', 'nolane.small-model.multi-file-refactor-skill.v1', 'nolane.small-model.typescript-refactor-skill.v1'].includes(skill.schema)) throw new Error('Unsupported verified skill schema');
  if (!skill.id || !skill.kind || skill.hiddenChainOfThoughtStored !== false) throw new Error('Skill identity or public-state evidence is missing');
  return skill;
}

export class VerifiedSkillRegistry {
  #skills = new Map();
  #history = new Map();
  #promotions = [];
  #rollbacks = 0;

  register(skill) {
    const value = verifySkill(skill);
    const existing = this.#skills.get(value.receiptSha256);
    if (existing) return existing;
    this.#skills.set(value.receiptSha256, value);
    return value;
  }

  promote({ skillReceiptSha256, evidenceBundle, approvedBy } = {}) {
    const skill = this.#skills.get(String(skillReceiptSha256));
    if (!skill) throw new Error('Unknown verified skill');
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required');
    const bundle = verifyReceipt(evidenceBundle, 'Checkpoint 8 evidence');
    if (bundle.schema !== 'nolane.small-model.checkpoint-8-evidence-bundle.v1' || bundle.allowed !== true) throw new Error('Checkpoint 8 allowed evidence bundle is required');
    const included = skill.schema === 'nolane.small-model.ast-skill.v2'
      ? bundle.astSkillReceiptSha256 === skill.receiptSha256
      : Array.isArray(bundle.constraintSkillReceiptSha256) && bundle.constraintSkillReceiptSha256.includes(skill.receiptSha256);
    if (!included) throw new Error('Checkpoint 8 evidence does not reference this skill');
    verifyReceipt(bundle.process, 'Checkpoint 8 process');
    verifyReceipt(bundle.cost, 'Checkpoint 8 cost');
    if (bundle.process.allowed !== true || !(Number(bundle.process.value) > 0)) throw new Error('Checkpoint 8 process evidence must be positive');
    if (bundle.cost.allowed !== true || bundle.cost.candidateCostLower !== true || !(Number(bundle.cost.totalCostRatio) < 1)) throw new Error('Checkpoint 8 cost evidence is insufficient');
    if (bundle.safety?.noRegression !== true || Number(bundle.safety.candidateViolations) > Number(bundle.safety.baselineViolations)) throw new Error('Checkpoint 8 safety regression is forbidden');
    if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false || bundle.claims?.frontierParity !== false) throw new Error('Checkpoint 8 non-claims must remain locked');
    const history = this.#history.get(skill.id) ?? [];
    if (history.at(-1)?.skillReceiptSha256 === skill.receiptSha256) return history.at(-1).receipt;
    const base = {
      schema: 'nolane.small-model.skill-promotion.v4', skillId: skill.id, kind: skill.kind, skillReceiptSha256: skill.receiptSha256,
      previousSkillReceiptSha256: history.at(-1)?.skillReceiptSha256 ?? null, evidenceBundleReceiptSha256: bundle.receiptSha256,
      processReceiptSha256: bundle.process.receiptSha256, costReceiptSha256: bundle.cost.receiptSha256,
      approvedBy: approval, status: 'promoted', governance: 'solver-transfer-proof-process-cost-required',
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    history.push({ skillReceiptSha256: skill.receiptSha256, receipt });
    this.#history.set(skill.id, history);
    this.#promotions.push(receipt);
    return receipt;
  }

  promoteCheckpoint9({ skillReceiptSha256, evidenceBundle, approvedBy } = {}) {
    const skill = this.#skills.get(String(skillReceiptSha256));
    if (!skill || skill.schema !== 'nolane.small-model.multi-file-refactor-skill.v1') throw new Error('Unknown checkpoint 9 refactor skill');
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required');
    const bundle = verifyReceipt(evidenceBundle, 'Checkpoint 9 evidence');
    if (bundle.schema !== 'nolane.small-model.checkpoint-9-evidence-bundle.v1' || bundle.allowed !== true || bundle.refactorSkillReceiptSha256 !== skill.receiptSha256) throw new Error('Checkpoint 9 allowed evidence bundle is required');
    verifyReceipt(bundle.process, 'Checkpoint 9 process');
    verifyReceipt(bundle.cost, 'Checkpoint 9 cost');
    if (!Array.isArray(bundle.propertyReceiptSha256) || bundle.propertyReceiptSha256.length !== 2 || !bundle.refactorTransferReceiptSha256) throw new Error('Checkpoint 9 transfer and property evidence are required');
    if (bundle.process.allowed !== true || !(Number(bundle.process.value) > 0)) throw new Error('Checkpoint 9 process evidence must be positive');
    if (bundle.cost.allowed !== true || bundle.cost.candidateCostLower !== true || !(Number(bundle.cost.totalCostRatio) < 1)) throw new Error('Checkpoint 9 cost evidence is insufficient');
    if (bundle.safety?.noRegression !== true || Number(bundle.safety.candidateViolations) > Number(bundle.safety.baselineViolations)) throw new Error('Checkpoint 9 safety regression is forbidden');
    if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false || bundle.claims?.frontierParity !== false || bundle.claims?.externalRepositoryGeneralization !== false) throw new Error('Checkpoint 9 non-claims must remain locked');
    const history = this.#history.get(skill.id) ?? [];
    if (history.at(-1)?.skillReceiptSha256 === skill.receiptSha256) return history.at(-1).receipt;
    const base = {
      schema: 'nolane.small-model.skill-promotion.v5', skillId: skill.id, kind: skill.kind, skillReceiptSha256: skill.receiptSha256,
      previousSkillReceiptSha256: history.at(-1)?.skillReceiptSha256 ?? null, evidenceBundleReceiptSha256: bundle.receiptSha256,
      transferReceiptSha256: bundle.refactorTransferReceiptSha256, propertyReceiptSha256: [...bundle.propertyReceiptSha256],
      processReceiptSha256: bundle.process.receiptSha256, costReceiptSha256: bundle.cost.receiptSha256,
      approvedBy: approval, status: 'promoted', governance: 'multi-file-transfer-property-process-cost-required',
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    history.push({ skillReceiptSha256: skill.receiptSha256, receipt });
    this.#history.set(skill.id, history);
    this.#promotions.push(receipt);
    return receipt;
  }

  promoteCheckpoint10({ skillReceiptSha256, evidenceBundle, approvedBy } = {}) {
    const skill = this.#skills.get(String(skillReceiptSha256));
    if (!skill || skill.schema !== 'nolane.small-model.typescript-refactor-skill.v1') throw new Error('Unknown checkpoint 10 TypeScript refactor skill');
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required');
    const bundle = verifyReceipt(evidenceBundle, 'Checkpoint 10 evidence');
    if (bundle.schema !== 'nolane.small-model.checkpoint-10-evidence-bundle.v1' || bundle.allowed !== true || bundle.typescriptSkillReceiptSha256 !== skill.receiptSha256) throw new Error('Checkpoint 10 allowed evidence bundle is required');
    verifyReceipt(bundle.process, 'Checkpoint 10 process'); verifyReceipt(bundle.cost, 'Checkpoint 10 cost');
    if (!bundle.transferReceiptSha256 || !bundle.propertyReceiptSha256 || !bundle.crossLanguageReceiptSha256) throw new Error('Checkpoint 10 transfer, property, and cross-language evidence are required');
    if (bundle.process.allowed !== true || !(Number(bundle.process.value) > 0)) throw new Error('Checkpoint 10 process evidence must be positive');
    if (bundle.cost.allowed !== true || bundle.cost.candidateCostLower !== true || !(Number(bundle.cost.totalCostRatio) < 1)) throw new Error('Checkpoint 10 cost evidence is insufficient');
    if (bundle.safety?.noRegression !== true || Number(bundle.safety.candidateViolations) > Number(bundle.safety.baselineViolations)) throw new Error('Checkpoint 10 safety regression is forbidden');
    if (bundle.claims?.generalCodingIntelligence !== false || bundle.claims?.competitorSuperiority !== false || bundle.claims?.frontierParity !== false || bundle.claims?.externalRepositoryGeneralization !== false) throw new Error('Checkpoint 10 non-claims must remain locked');
    const history = this.#history.get(skill.id) ?? [];
    if (history.at(-1)?.skillReceiptSha256 === skill.receiptSha256) return history.at(-1).receipt;
    const base = { schema:'nolane.small-model.skill-promotion.v6', skillId:skill.id, kind:'typescript-semantic-refactor', skillReceiptSha256:skill.receiptSha256, previousSkillReceiptSha256:history.at(-1)?.skillReceiptSha256 ?? null, evidenceBundleReceiptSha256:bundle.receiptSha256, transferReceiptSha256:bundle.transferReceiptSha256, propertyReceiptSha256:bundle.propertyReceiptSha256, crossLanguageReceiptSha256:bundle.crossLanguageReceiptSha256, processReceiptSha256:bundle.process.receiptSha256, costReceiptSha256:bundle.cost.receiptSha256, approvedBy:approval, status:'promoted', governance:'typescript-transfer-property-cross-language-process-cost-required' };
    const receipt=deepFreeze({...base,receiptSha256:canonicalSha256(base)}); history.push({skillReceiptSha256:skill.receiptSha256,receipt}); this.#history.set(skill.id,history); this.#promotions.push(receipt); return receipt;
  }

  active(id) {
    const record = (this.#history.get(String(id)) ?? []).at(-1);
    return record ? this.#skills.get(record.skillReceiptSha256) ?? null : null;
  }

  activePromotion(id) { return (this.#history.get(String(id)) ?? []).at(-1)?.receipt ?? null; }

  rollback(id, { approvedBy } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required for skill rollback');
    const history = this.#history.get(String(id)) ?? [];
    if (history.length < 2) throw new Error(`No rollback skill version for ${id}`);
    const removed = history.pop();
    this.#history.set(String(id), history);
    this.#rollbacks += 1;
    const active = this.#skills.get(history.at(-1).skillReceiptSha256);
    const base = { schema: 'nolane.small-model.skill-rollback.v1', skillId: String(id), removedSkillReceiptSha256: removed.skillReceiptSha256, skillReceiptSha256: active.receiptSha256, approvedBy: approval };
    return deepFreeze({ ...active, rollbackReceiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({
      schema: 'nolane.small-model.verified-skill-registry.v1', skills: this.#skills.size, activeSkills: this.#history.size,
      promotions: this.#promotions.length, rollbacks: this.#rollbacks,
      active: Object.fromEntries([...this.#history].map(([id, history]) => [id, history.at(-1)?.skillReceiptSha256 ?? null])),
    });
  }
}
