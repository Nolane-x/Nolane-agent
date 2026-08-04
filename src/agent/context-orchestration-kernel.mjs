import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';
import { selectEvidence } from '../context/context-utility-selector.mjs';

const DAY_MS = 86_400_000;
const ROLES = Object.freeze(['planner', 'executor', 'reviewer', 'debugger', 'subagent']);
const DEFAULT_BUDGETS = Object.freeze({ planner: 12_000, executor: 8_000, reviewer: 10_000, debugger: 14_000, subagent: 6_000 });
const DEFAULT_COMPACTION = Object.freeze({ conversationChars: 8_000, fileChars: 16_000, logChars: 12_000 });
const SOURCE_PRIORITY = Object.freeze({ diagnostics: 700, diff: 620, test: 560, code: 520, file: 500, memory: 430, conversation: 400, log: 280 });

function asText(value) { return typeof value === 'string' ? value : String(value ?? ''); }
function estimateTokens(text) { return Math.max(1, Math.ceil(asText(text).length / 4)); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function ageDays(clock, value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (clock - timestamp) / DAY_MS);
}
function ageBand(days) { return days >= 21 ? 'old' : days >= 7 ? 'aging' : 'recent'; }
function freshness(item, days) {
  if (item.sourceHash && item.currentHash) return item.sourceHash === item.currentHash ? 'fresh' : 'stale';
  if (item.current === true) return 'fresh';
  if (days >= 21) return 'stale';
  return 'unknown';
}
function stableRef(item, rawText) {
  return Object.freeze({ artifactId: item.artifactId ?? null, sha256: /^[a-f0-9]{64}$/i.test(item.sourceHash ?? '') ? String(item.sourceHash).toLowerCase() : canonicalSha256(rawText) });
}
function compactConversation(text, limit) {
  const lines = text.split(/\r?\n/);
  const significant = lines.filter((line) => /^(Objective|Decision|Result|Outcome|Constraint|Error|Blocker|Next)\s*:/i.test(line.trim()));
  const tail = lines.slice(-6);
  const selected = unique([...significant, ...tail]);
  const output = selected.join('\n');
  return output.length > limit ? `${output.slice(0, Math.max(0, limit - 16))}\n[COMPACTED]` : output;
}
function compactFile(text, limit) {
  const lines = text.split(/\r?\n/);
  const declarations = lines.filter((line) => /\b(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const\s+\w+\s*=\s*(?:async\s*)?\(|def|func|route|router\.|app\.)\b/i.test(line));
  const selected = unique([...lines.slice(0, 8), ...declarations, ...lines.slice(-8)]);
  const output = selected.join('\n');
  return output.length > limit ? `${output.slice(0, Math.max(0, limit - 16))}\n[COMPACTED]` : output;
}
function compactLog(text, limit) {
  const lines = text.split(/\r?\n/);
  const significant = lines.filter((line) => /\b(?:error|warn|fail|exception|denied|timeout)\b/i.test(line));
  const output = unique([...significant.slice(-20), ...lines.slice(-20)]).join('\n');
  return output.length > limit ? `${output.slice(0, Math.max(0, limit - 16))}\n[COMPACTED]` : output;
}
function compact(item, text, thresholds, days) {
  let compactedText = text;
  let compacted = false;
  if (item.sourceType === 'conversation' && days >= 7 && text.length > thresholds.conversationChars) {
    compactedText = compactConversation(text, thresholds.conversationChars);
    compacted = compactedText.length < text.length;
  } else if (['file', 'code'].includes(item.sourceType) && text.length > thresholds.fileChars) {
    compactedText = compactFile(text, thresholds.fileChars);
    compacted = compactedText.length < text.length;
  } else if (item.sourceType === 'log' && text.length > thresholds.logChars) {
    compactedText = compactLog(text, thresholds.logChars);
    compacted = compactedText.length < text.length;
  }
  return { text: compactedText, compacted, originalRef: compacted ? stableRef(item, text) : null };
}
function permissionReason(item, { projectId, principalId, role }) {
  if (item.projectId && item.projectId !== projectId) return 'denied: cross-project context';
  if (Array.isArray(item.allowedRoles) && !item.allowedRoles.includes(role)) return 'denied: role not allowed';
  if (Array.isArray(item.allowedPrincipals) && !item.allowedPrincipals.includes(principalId)) return 'denied: principal not allowed';
  return null;
}
function priority(item, days, freshnessValue) {
  let score = SOURCE_PRIORITY[item.sourceType] ?? 360;
  if (item.current === true) score += 1_000;
  if (item.severity === 'error') score += 800;
  else if (item.severity === 'warning') score += 300;
  if (item.pinned === true) score += 1_200;
  if (freshnessValue === 'stale') score -= 180;
  if (item.sourceType === 'log') score -= Math.min(420, Math.floor(days * 14));
  else score -= Math.min(160, Math.floor(days * 3));
  return score;
}
function safePublicItem(item) {
  const copy = { ...item };
  delete copy.allowedPrincipals;
  delete copy.secretValues;
  return copy;
}

export class ContextOrchestrationKernel {
  constructor({ clock = Date.now, budgets = {}, compaction = {}, selectionMode = 'legacy', counterEvidenceRatio = 0.1, minMarginalUtility = 0 } = {}) {
    this.clock = clock;
    this.budgets = Object.freeze({ ...DEFAULT_BUDGETS, ...budgets });
    this.compaction = Object.freeze({ ...DEFAULT_COMPACTION, ...compaction });
    if (!['legacy', 'utility'].includes(selectionMode)) throw new TypeError('selectionMode must be legacy or utility');
    this.selectionMode = selectionMode;
    this.counterEvidenceRatio = Number(counterEvidenceRatio);
    this.minMarginalUtility = Number(minMarginalUtility);
  }

  plan({ projectId, principalId, role, items = [], budgetTokens } = {}) {
    if (!projectId) throw new TypeError('projectId is required');
    if (!principalId) throw new TypeError('principalId is required');
    if (!ROLES.includes(role)) throw new TypeError(`role must be one of: ${ROLES.join(', ')}`);
    if (!Array.isArray(items)) throw new TypeError('items must be an array');
    const roleBudget = Number(this.budgets[role]);
    if (!Number.isInteger(roleBudget) || roleBudget <= 0) throw new TypeError(`invalid budget for role ${role}`);
    const requestedBudget = budgetTokens === undefined ? roleBudget : Number(budgetTokens);
    if (!Number.isInteger(requestedBudget) || requestedBudget <= 0) throw new TypeError('budgetTokens must be a positive integer');
    if (requestedBudget > roleBudget) throw new Error(`budgetTokens may only lower the ${role} budget`);

    const now = Number(this.clock());
    const omissions = [];
    const normalized = [];
    for (const input of items) {
      const reason = permissionReason(input, { projectId, principalId, role });
      if (reason) { omissions.push(Object.freeze({ id: input?.id ?? null, reason })); continue; }
      const rawText = asText(input.text);
      const redactedText = redactSecrets(rawText, { secretValues: input.secretValues ?? [] });
      const days = ageDays(now, input.updatedAt ?? input.createdAt);
      const fresh = freshness(input, days);
      const compacted = compact(input, redactedText, this.compaction, days);
      const publicItem = safePublicItem(input);
      const text = compacted.text;
      normalized.push(Object.freeze({
        ...publicItem,
        text,
        ageDays: Number(days.toFixed(3)),
        ageBand: ageBand(days),
        freshness: fresh,
        compacted: compacted.compacted,
        ...(compacted.originalRef ? { originalRef: compacted.originalRef } : {}),
        estimatedTokens: estimateTokens(text),
        priorityScore: priority(input, days, fresh),
      }));
    }

    normalized.sort((a, b) => b.priorityScore - a.priorityScore || String(a.id).localeCompare(String(b.id)));
    let selected = [];
    let usedTokens = 0;
    let counterEvidenceTokens = 0;
    let selectedUtility = [];
    if (this.selectionMode === 'utility') {
      const utility = selectEvidence(normalized.map((entry) => ({
        ...entry, tokenCost: entry.estimatedTokens,
        relevance: entry.relevance ?? Math.max(0, Math.min(1, entry.priorityScore / 2_000)),
        trust: entry.trust ?? entry.confidence ?? (['diagnostics', 'test', 'code'].includes(entry.sourceType) ? 0.9 : 0.65),
        decisionImpact: entry.decisionImpact ?? (entry.current || entry.severity === 'error' ? 1 : 0.55),
        coverage: entry.coverage ?? 0.5,
      })), { budgetTokens: requestedBudget, counterEvidenceRatio: this.counterEvidenceRatio, minMarginalUtility: this.minMarginalUtility });
      const selectedIds = new Set(utility.selected.map((entry) => entry.id));
      selected = utility.selected.map((entry) => normalized.find((item) => item.id === entry.id)).filter(Boolean);
      usedTokens = utility.usedTokens;
      counterEvidenceTokens = utility.counterEvidenceTokens;
      selectedUtility = utility.selectedUtility;
      for (const omission of utility.omissions) if (!omissions.some((item) => item.id === omission.id)) omissions.push(omission);
      for (const entry of normalized) if (!selectedIds.has(entry.id) && !omissions.some((item) => item.id === entry.id)) omissions.push(Object.freeze({ id: entry.id, reason: 'not-selected' }));
    } else {
      for (const entry of normalized) {
        if (usedTokens + entry.estimatedTokens > requestedBudget) {
          omissions.push(Object.freeze({ id: entry.id, reason: 'budget-exceeded', estimatedTokens: entry.estimatedTokens }));
          continue;
        }
        selected.push(entry);
        usedTokens += entry.estimatedTokens;
        if (entry.polarity === 'counter' || (Array.isArray(entry.contradicts) && entry.contradicts.length)) counterEvidenceTokens += entry.estimatedTokens;
      }
    }
    const sourceUsage = {};
    for (const entry of normalized) {
      const key = entry.sourceType || 'unknown';
      const current = sourceUsage[key] ?? { itemCount: 0, selectedCount: 0, estimatedTokens: 0, selectedTokens: 0 };
      current.itemCount += 1;
      current.estimatedTokens += entry.estimatedTokens;
      if (selected.includes(entry)) { current.selectedCount += 1; current.selectedTokens += entry.estimatedTokens; }
      sourceUsage[key] = current;
    }
    for (const value of Object.values(sourceUsage)) Object.freeze(value);
    const receiptBase = {
      schema: 'forge.context-orchestration-plan.v1', projectId, principalId, role,
      budgetTokens: requestedBudget, usedTokens, remainingTokens: requestedBudget - usedTokens,
      selectionMode: this.selectionMode, counterEvidenceTokens, selectedUtility,
      itemDigests: normalized.map((entry) => ({ id: entry.id, digest: canonicalSha256(entry) })),
      selectedIds: selected.map((entry) => entry.id), omissions,
      sourceUsage,
    };
    return Object.freeze({
      schema: receiptBase.schema, projectId, principalId, role,
      budgetTokens: requestedBudget, usedTokens, remainingTokens: requestedBudget - usedTokens,
      selectionMode: this.selectionMode, counterEvidenceTokens, selectedUtility: Object.freeze(selectedUtility),
      items: Object.freeze(normalized), selected: Object.freeze(selected), omissions: Object.freeze(omissions),
      sourceUsage: Object.freeze(sourceUsage), receiptSha256: canonicalSha256(receiptBase),
    });
  }
}
