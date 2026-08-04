import crypto from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/i;
const FORBIDDEN_REASONING_KEYS = new Set(['chainOfThought', 'hiddenReasoning', 'reasoningText', 'privateReasoning', 'scratchpad']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertNoHiddenReasoning(value, trail = 'response') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.has(key)) throw new Error(`hidden reasoning is forbidden at ${trail}.${key}`);
    assertNoHiddenReasoning(child, `${trail}.${key}`);
  }
}

function normalizeCriteria(criteria) {
  const ids = (criteria ?? []).map((criterion, index) => required(
    typeof criterion === 'object' && criterion !== null ? (criterion.id ?? `criterion-${index + 1}`) : criterion,
    `criterion ${index + 1} id`,
  ));
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`duplicate criterion: ${id}`);
    seen.add(id);
  }
  return Object.freeze(ids);
}

function normalizeEffects(effects) {
  return Object.freeze((effects ?? []).map((effect, index) => {
    const receiptSha256 = String(effect?.receiptSha256 ?? '');
    if (!SHA256.test(receiptSha256)) throw new Error(`effect receipt ${index + 1} must be SHA-256`);
    return Object.freeze({
      effectMatched: effect?.effectMatched === true,
      receiptSha256: receiptSha256.toLowerCase(),
    });
  }));
}

export class GoalEvidenceContract {
  constructor({ missionId, objective, criteria = [] } = {}) {
    this.missionId = required(missionId, 'missionId');
    this.objective = required(objective, 'objective');
    this.criterionIds = normalizeCriteria(criteria);
  }

  verify({ actorId, verifierId, response = {}, effects = [] } = {}) {
    const actor = required(actorId, 'actorId');
    const verifier = required(verifierId, 'verifierId');
    if (actor === verifier) throw new Error('completion requires an independent verifier');
    assertNoHiddenReasoning(response);
    const normalizedEffects = normalizeEffects(effects);
    const observed = new Set(normalizedEffects.filter((effect) => effect.effectMatched).map((effect) => effect.receiptSha256));
    const proof = new Map();
    for (const item of response?.criteriaProof ?? []) {
      const id = required(item?.id, 'criteria proof id');
      if (proof.has(id)) throw new Error(`duplicate criterion proof: ${id}`);
      proof.set(id, item);
    }
    const criteria = this.criterionIds.map((id) => {
      const item = proof.get(id);
      const receiptSha256 = String(item?.evidenceReceiptSha256 ?? '').toLowerCase();
      const verified = item?.verified === true && SHA256.test(receiptSha256) && observed.has(receiptSha256);
      return Object.freeze({ id, verified, evidenceReceiptSha256: verified ? receiptSha256 : null });
    });
    const effectsValid = normalizedEffects.length > 0 && normalizedEffects.every((effect) => effect.effectMatched);
    const criteriaValid = this.criterionIds.length > 0 ? criteria.every((criterion) => criterion.verified) : effectsValid;
    const verified = effectsValid && criteriaValid;
    const receiptBase = stable({
      schema: 'nolane.goal-evidence-contract.v1',
      missionId: this.missionId,
      objective: this.objective,
      actorId: actor,
      verifierId: verifier,
      status: verified ? 'completed' : 'needs-evidence',
      verified,
      effectsValid,
      criteria,
      observedEffectReceipts: [...observed].sort(),
      reason: verified ? 'independently-verified-evidence' : 'missing-or-invalid-evidence',
    });
    return deepFreeze({ ...receiptBase, receiptSha256: sha256(JSON.stringify(receiptBase)) });
  }
}
