import { boundedNumber, signed, text } from './construction-utils.mjs';

const BASE = Object.freeze({
  bugfix: { maxFiles: 2, maxChangedLines: 80 },
  feature: { maxFiles: 5, maxChangedLines: 300 },
  refactor: { maxFiles: 12, maxChangedLines: 1_000 },
  migration: { maxFiles: 16, maxChangedLines: 1_500 },
});
const RISK_FACTOR = Object.freeze({ low: 1, medium: 1, high: 0.8, critical: 0.6 });

export function derivePatchBudget({ taskKind = 'bugfix', risk = 'low', requested = null, expansionEvidenceReceiptId = null } = {}) {
  const kind = text(taskKind, 'taskKind', 128);
  const riskLevel = text(risk, 'risk', 64);
  const base = BASE[kind] ?? BASE.bugfix;
  const factor = RISK_FACTOR[riskLevel] ?? 0.8;
  let maxFiles = Math.max(1, Math.floor(base.maxFiles * factor));
  let maxChangedLines = Math.max(20, Math.floor(base.maxChangedLines * factor));
  let expanded = false;
  if (requested) {
    const requestFiles = Math.floor(boundedNumber(requested.maxFiles, maxFiles, 1, 32, 'requested.maxFiles'));
    const requestLines = Math.floor(boundedNumber(requested.maxChangedLines, maxChangedLines, 1, 20_000, 'requested.maxChangedLines'));
    if (requestFiles > maxFiles || requestLines > maxChangedLines) {
      if (!expansionEvidenceReceiptId) throw new Error('patch budget expansion requires evidence');
      maxFiles = requestFiles; maxChangedLines = requestLines; expanded = true;
    }
  }
  return signed({ schema: 'forge.dynamic-patch-budget.v1', taskKind: kind, risk: riskLevel, maxFiles, maxChangedLines, expanded, expansionEvidenceReceiptId: expanded ? text(expansionEvidenceReceiptId, 'expansionEvidenceReceiptId', 512) : null, claims: { hardConstraintsWeakened: false, universalBudgetUsed: false } });
}
