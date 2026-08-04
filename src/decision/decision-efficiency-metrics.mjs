import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
function text(value, label, max = 512) { const output = String(value ?? '').trim(); if (!output) throw new TypeError(`${label} is required`); if (output.length > max) throw new TypeError(`${label} is too long`); return output; }
function nonNegative(value, label) { const output = Number(value ?? 0); if (!Number.isFinite(output) || output < 0) throw new TypeError(`${label} must be non-negative`); return output; }
function integer(value, label) { const output = Number(value ?? 0); if (!Number.isInteger(output) || output < 0) throw new TypeError(`${label} must be a non-negative integer`); return output; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function ratio(value, denominator) { return denominator > 0 && value > 0 ? value / denominator : 0; }
function receipt(value, label) { const output = String(value ?? '').trim().toLowerCase(); if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`); return output; }
function scoreSnapshot(value, label) {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} is required`);
  const totalCriteriaWeight = nonNegative(value.totalCriteriaWeight, `${label}.totalCriteriaWeight`);
  const verifiedCriteriaScore = Math.min(totalCriteriaWeight, nonNegative(value.verifiedCriteriaScore, `${label}.verifiedCriteriaScore`));
  return { totalCriteriaWeight, verifiedCriteriaScore, receiptSha256: receipt(value.receiptSha256, `${label}.receiptSha256`) };
}

export function computeDecisionEfficiency(input = {}) {
  const taskId = text(input.taskId, 'taskId');
  const outcome = input.outcomeSnapshot && typeof input.outcomeSnapshot === 'object' ? input.outcomeSnapshot : null;
  const taskScore = scoreSnapshot(outcome?.taskScore ?? input.criterionSnapshot, outcome ? 'outcomeSnapshot.taskScore' : 'criterionSnapshot');
  const milestoneScore = outcome?.milestoneScore ? scoreSnapshot(outcome.milestoneScore, 'outcomeSnapshot.milestoneScore') : null;
  const missionScore = outcome?.missionScore ? scoreSnapshot(outcome.missionScore, 'outcomeSnapshot.missionScore') : null;
  const decisionId = text(outcome?.decisionId ?? input.decisionId ?? `decision:${taskId}`, 'decisionId');
  if (outcome?.decisionId && input.decisionId && String(outcome.decisionId) !== String(input.decisionId)) throw new TypeError('outcomeSnapshot.decisionId must match decisionId');
  const totalCriteriaWeight = taskScore.totalCriteriaWeight;
  const verifiedValue = taskScore.verifiedCriteriaScore;
  const criterionReceiptSha256 = taskScore.receiptSha256;
  const inputTokens = integer(input.inputTokens, 'inputTokens');
  const outputTokens = integer(input.outputTokens, 'outputTokens');
  const totalTokens = inputTokens + outputTokens;
  const contextUtility = outcome?.contextUtility;
  const contextTokensSelected = contextUtility ? integer(contextUtility.contextTokensSelected, 'outcomeSnapshot.contextUtility.contextTokensSelected') : integer(input.contextTokensSelected, 'contextTokensSelected');
  const contextTokensActuallyUseful = contextUtility ? integer(contextUtility.contextTokensActuallyUseful, 'outcomeSnapshot.contextUtility.contextTokensActuallyUseful') : integer(input.contextTokensActuallyUseful, 'contextTokensActuallyUseful');
  if (contextTokensActuallyUseful > contextTokensSelected) throw new TypeError('contextTokensActuallyUseful cannot exceed contextTokensSelected');
  const contextUtilityReceiptSha256 = contextUtility ? receipt(contextUtility.receiptSha256, 'outcomeSnapshot.contextUtility.receiptSha256') : null;
  const costAttributionReceiptSha256 = outcome?.cost ? receipt(outcome.cost.receiptSha256, 'outcomeSnapshot.cost.receiptSha256') : null;
  const rssMbSeconds = nonNegative(input.rssMbSeconds, 'rssMbSeconds');
  const memoryMbMinutes = rssMbSeconds / 60;
  const changedLines = integer(input.changedLines, 'changedLines');
  const changedFiles = integer(input.changedFiles, 'changedFiles');
  const semanticFootprint = nonNegative(input.semanticFootprint, 'semanticFootprint');
  const correctionCycles = integer(input.correctionCycles, 'correctionCycles');
  const revertedLines = integer(input.revertedLines, 'revertedLines');
  const humanInterventions = integer(input.humanInterventions, 'humanInterventions');
  const editCostUnits = changedLines + revertedLines + semanticFootprint + (correctionCycles * 10) + (humanInterventions * 20);
  const base = {
    schema: 'forge.decision-efficiency-observation.v2',
    taskId,
    decisionId,
    providerId: text(input.providerId, 'providerId'),
    taskKind: text(input.taskKind ?? 'general', 'taskKind'),
    totalCriteriaWeight,
    verifiedValue,
    verifiedCriteriaHierarchy: {
      task: taskScore.verifiedCriteriaScore,
      milestone: milestoneScore?.verifiedCriteriaScore ?? taskScore.verifiedCriteriaScore,
      mission: missionScore?.verifiedCriteriaScore ?? taskScore.verifiedCriteriaScore,
    },
    criterionReceiptSha256,
    outcomeReceipts: {
      taskScore: taskScore.receiptSha256,
      milestoneScore: milestoneScore?.receiptSha256 ?? null,
      missionScore: missionScore?.receiptSha256 ?? null,
      contextUtility: contextUtilityReceiptSha256,
      costAttribution: costAttributionReceiptSha256,
    },
    inputTokens,
    outputTokens,
    totalTokens,
    contextTokensSelected,
    contextTokensActuallyUseful,
    tokenYield: ratio(verifiedValue, totalTokens / 1_000),
    rssMbSeconds,
    memoryMbMinutes,
    memoryYield: ratio(verifiedValue, memoryMbMinutes),
    changedLines,
    changedFiles,
    semanticFootprint,
    editCostUnits,
    editYield: ratio(verifiedValue, editCostUnits),
    correctionLineage: { correctionCycles, revertedLines, firstPatchPassed: input.firstPatchPassed === true, humanInterventions },
    observedAtMs: integer(input.observedAtMs, 'observedAtMs'),
  };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class DecisionEfficiencyMetrics {
  constructor({ maxEntries = 2_000 } = {}) { this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 2_000)); this.entries = []; }
  record(input) {
    const entry = computeDecisionEfficiency(input);
    this.entries.push(entry);
    while (this.entries.length > this.maxEntries) this.entries.shift();
    return entry;
  }
  snapshot() {
    const samples = this.entries.length;
    const average = (key) => samples ? this.entries.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / samples : 0;
    const base = {
      schema: 'forge.decision-efficiency-metrics-snapshot.v2',
      entries: [...this.entries],
      summary: { samples, verifiedValue: average('verifiedValue'), tokenYield: average('tokenYield'), memoryYield: average('memoryYield'), editYield: average('editYield') },
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
