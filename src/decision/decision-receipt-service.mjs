import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const FORBIDDEN_KEYS = new Set([
  'chainofthought', 'rawprompt', 'prompt', 'systemprompt', 'modeloutput', 'rawoutput',
  'environment', 'env', 'password', 'secret', 'apikey', 'api_key', 'authorization',
  'cookie', 'cookies', 'credential', 'credentials', 'accesstoken', 'refreshtoken',
]);
const SHA256 = /^[a-f0-9]{64}$/;

function assertNoPrivateFields(value, path = '$', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new TypeError(`cyclic input at ${path}`);
  seen.add(value);
  try {
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.replaceAll('-', '').replaceAll('_', '').toLowerCase();
      if (FORBIDDEN_KEYS.has(normalized)) throw new TypeError(`forbidden private or secret field at ${path}.${key}`);
      assertNoPrivateFields(child, `${path}.${key}`, seen);
    }
  } finally {
    seen.delete(value);
  }
}

function text(value, label, max = 4_000) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}

function optionalText(value, max = 4_000) {
  const output = String(value ?? '').trim();
  return output ? output.slice(0, max) : '';
}

function finiteNonNegative(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a finite non-negative number`);
  return number;
}

function integerNonNegative(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return number;
}

function stringArray(value, label, { min = 0, maxItems = 256, itemMax = 1_000 } = {}) {
  if (!Array.isArray(value) || value.length < min) throw new TypeError(`${label} must contain at least ${min} item(s)`);
  if (value.length > maxItems) throw new TypeError(`${label} exceeds ${maxItems} items`);
  return value.map((item, index) => text(item, `${label}[${index}]`, itemMax));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeHypotheses(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) throw new TypeError('hypotheses must contain 1 to 16 items');
  const ids = new Set();
  return value.map((item, index) => {
    const id = text(item?.id, `hypotheses[${index}].id`, 256);
    if (ids.has(id)) throw new TypeError(`duplicate hypothesis id: ${id}`);
    ids.add(id);
    const confidence = Number(item?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new TypeError(`hypotheses[${index}].confidence must be between 0 and 1`);
    return { id, confidence, claim: text(item?.claim, `hypotheses[${index}].claim`, 4_000) };
  });
}

function normalizeAlternatives(value = []) {
  if (!Array.isArray(value) || value.length > 32) throw new TypeError('alternativesRejected must be an array of at most 32 items');
  return value.map((item, index) => ({
    action: text(item?.action, `alternativesRejected[${index}].action`, 4_000),
    reason: text(item?.reason, `alternativesRejected[${index}].reason`, 4_000),
  }));
}

function normalizePatchMetrics(value = {}) {
  return {
    files: integerNonNegative(value.files, 'patchMetrics.files'),
    changedLines: integerNonNegative(value.changedLines, 'patchMetrics.changedLines'),
    semanticFootprint: finiteNonNegative(value.semanticFootprint, 'patchMetrics.semanticFootprint'),
    revertedLines: integerNonNegative(value.revertedLines, 'patchMetrics.revertedLines'),
  };
}

function normalizeVerification(value = {}) {
  const allowed = ['targetedTests', 'impactedTests', 'fullSuite', 'review', 'security'];
  const output = {};
  for (const key of allowed) {
    const normalized = optionalText(value[key], 128);
    if (normalized) output[key] = normalized;
  }
  output.verifiedCriterionIds = stringArray(value.verifiedCriterionIds ?? [], 'verification.verifiedCriterionIds', { maxItems: 256, itemMax: 256 });
  return output;
}

function normalizeResourceCost(value = {}) {
  return {
    inputTokens: integerNonNegative(value.inputTokens, 'resourceCost.inputTokens'),
    outputTokens: integerNonNegative(value.outputTokens, 'resourceCost.outputTokens'),
    contextTokens: integerNonNegative(value.contextTokens, 'resourceCost.contextTokens'),
    rssMbSeconds: finiteNonNegative(value.rssMbSeconds, 'resourceCost.rssMbSeconds'),
    elapsedMs: finiteNonNegative(value.elapsedMs, 'resourceCost.elapsedMs'),
  };
}

function normalizeCriterionSnapshot(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('criterionSnapshot must be an object');
  const criteria = Array.isArray(value.criteria) ? value.criteria.map((item, index) => ({
    criterionId: text(item?.criterionId, `criterionSnapshot.criteria[${index}].criterionId`, 256),
    weight: finiteNonNegative(item?.weight, `criterionSnapshot.criteria[${index}].weight`),
    verified: item?.verified === true,
  })) : [];
  const receiptSha256 = String(value.receiptSha256 ?? '').trim().toLowerCase();
  if (receiptSha256 && !SHA256.test(receiptSha256)) throw new TypeError('criterionSnapshot.receiptSha256 must be SHA-256');
  return {
    taskId: text(value.taskId, 'criterionSnapshot.taskId', 256),
    totalCriteriaWeight: finiteNonNegative(value.totalCriteriaWeight, 'criterionSnapshot.totalCriteriaWeight'),
    verifiedCriteriaScore: finiteNonNegative(value.verifiedCriteriaScore, 'criterionSnapshot.verifiedCriteriaScore'),
    criteria,
    receiptSha256: receiptSha256 || null,
  };
}

export function createDecisionReceipt(input = {}) {
  assertNoPrivateFields(input);
  const base = {
    schema: 'forge.decision-receipt.v1',
    decisionId: text(input.decisionId, 'decisionId', 256),
    taskId: text(input.taskId, 'taskId', 256),
    goal: text(input.goal, 'goal', 8_000),
    hypotheses: normalizeHypotheses(input.hypotheses),
    evidenceUsed: stringArray(input.evidenceUsed, 'evidenceUsed', { min: 1, maxItems: 512, itemMax: 256 }),
    counterEvidenceUsed: stringArray(input.counterEvidenceUsed ?? [], 'counterEvidenceUsed', { maxItems: 256, itemMax: 256 }),
    alternativesRejected: normalizeAlternatives(input.alternativesRejected),
    selectedAction: text(input.selectedAction, 'selectedAction', 20_000),
    expectedImpact: stringArray(input.expectedImpact ?? [], 'expectedImpact', { maxItems: 256, itemMax: 1_000 }),
    actualImpact: stringArray(input.actualImpact ?? [], 'actualImpact', { maxItems: 256, itemMax: 1_000 }),
    patchMetrics: normalizePatchMetrics(input.patchMetrics),
    verification: normalizeVerification(input.verification),
    resourceCost: normalizeResourceCost(input.resourceCost),
    criterionSnapshot: normalizeCriterionSnapshot(input.criterionSnapshot),
    createdAtMs: integerNonNegative(input.createdAtMs, 'createdAtMs'),
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
