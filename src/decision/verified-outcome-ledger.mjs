import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const COST_CATEGORIES = new Set(['token', 'tool', 'model', 'process', 'context']);
const VERIFICATION_STATUSES = new Set(['pass', 'fail', 'blocked', 'inconclusive']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function text(value, label, max = 256) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} is too long`);
  return output;
}
function sha(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}
function finiteNonNegative(value, label) {
  const output = Number(value);
  if (!Number.isFinite(output) || output < 0) throw new TypeError(`${label} must be a non-negative number`);
  return output;
}
function integerNonNegative(value, label) {
  const output = Number(value);
  if (!Number.isInteger(output) || output < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return output;
}
function uniqueSorted(values) { return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b))); }

export class VerifiedOutcomeLedger {
  constructor({ clock = () => Date.now(), maxMissions = 1_000, maxVerifications = 20_000, maxCosts = 50_000 } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxMissions = Math.max(1, Math.floor(Number(maxMissions) || 1_000));
    this.maxVerifications = Math.max(1, Math.floor(Number(maxVerifications) || 20_000));
    this.maxCosts = Math.max(1, Math.floor(Number(maxCosts) || 50_000));
    this.missions = new Map();
    this.milestones = new Map();
    this.tasks = new Map();
    this.decisions = new Map();
    this.verifications = new Map();
    this.contextSelections = new Map();
    this.contextLinks = new Map();
    this.costs = new Map();
    this.closed = false;
  }

  registerMission(input = {}) {
    this.#assertOpen();
    const missionId = text(input.missionId, 'missionId');
    if (this.missions.has(missionId)) throw new TypeError(`duplicate mission: ${missionId}`);
    if (this.missions.size >= this.maxMissions) throw new RangeError(`mission capacity exceeded: ${this.maxMissions}`);
    const record = { missionId, milestoneIds: new Set(), taskIds: new Set(), decisionIds: new Set(), createdAtMs: Math.trunc(Number(this.clock())) };
    this.missions.set(missionId, record);
    return signed({ schema: 'forge.verified-outcome-mission.v1', missionId, createdAtMs: record.createdAtMs });
  }

  registerMilestone(input = {}) {
    this.#assertOpen();
    const missionId = text(input.missionId, 'missionId');
    const milestoneId = text(input.milestoneId, 'milestoneId');
    const mission = this.#mission(missionId);
    if (this.milestones.has(milestoneId)) throw new TypeError(`duplicate milestone: ${milestoneId}`);
    const record = { milestoneId, missionId, taskIds: new Set(), decisionIds: new Set(), createdAtMs: Math.trunc(Number(this.clock())) };
    this.milestones.set(milestoneId, record);
    mission.milestoneIds.add(milestoneId);
    return signed({ schema: 'forge.verified-outcome-milestone.v1', missionId, milestoneId, createdAtMs: record.createdAtMs });
  }

  registerTask(input = {}) {
    this.#assertOpen();
    const missionId = text(input.missionId, 'missionId');
    const milestoneId = text(input.milestoneId, 'milestoneId');
    const taskId = text(input.taskId, 'taskId');
    const mission = this.#mission(missionId);
    const milestone = this.#milestone(milestoneId);
    if (milestone.missionId !== missionId) throw new TypeError('milestone does not belong to mission');
    if (this.tasks.has(taskId)) throw new TypeError(`duplicate task: ${taskId}`);
    if (!Array.isArray(input.criteria) || input.criteria.length === 0 || input.criteria.length > 256) throw new TypeError('criteria must contain 1-256 items');
    const criteria = new Map();
    for (const item of input.criteria) {
      const criterionId = text(item?.criterionId, 'criteria[].criterionId');
      if (criteria.has(criterionId)) throw new TypeError(`duplicate criterion: ${criterionId}`);
      const weight = finiteNonNegative(item?.weight, `criterion ${criterionId} weight`);
      if (weight <= 0) throw new TypeError(`criterion ${criterionId} weight must be positive`);
      criteria.set(criterionId, { criterionId, weight, verificationReceipts: new Set() });
    }
    const record = { taskId, missionId, milestoneId, criteria, decisionIds: new Set(), createdAtMs: Math.trunc(Number(this.clock())) };
    this.tasks.set(taskId, record);
    milestone.taskIds.add(taskId);
    mission.taskIds.add(taskId);
    return signed({ schema: 'forge.verified-outcome-task.v1', missionId, milestoneId, taskId, criteria: [...criteria.values()].map(({ criterionId, weight }) => ({ criterionId, weight })), createdAtMs: record.createdAtMs });
  }

  registerDecision(input = {}) {
    this.#assertOpen();
    const missionId = text(input.missionId, 'missionId');
    const milestoneId = text(input.milestoneId, 'milestoneId');
    const taskId = text(input.taskId, 'taskId');
    const decisionId = text(input.decisionId, 'decisionId');
    const mission = this.#mission(missionId);
    const milestone = this.#milestone(milestoneId);
    const task = this.#task(taskId);
    if (milestone.missionId !== missionId || task.missionId !== missionId || task.milestoneId !== milestoneId) throw new TypeError('decision scope hierarchy is inconsistent');
    if (this.decisions.has(decisionId)) throw new TypeError(`duplicate decision: ${decisionId}`);
    const record = { decisionId, missionId, milestoneId, taskId, createdAtMs: Math.trunc(Number(this.clock())) };
    this.decisions.set(decisionId, record);
    mission.decisionIds.add(decisionId);
    milestone.decisionIds.add(decisionId);
    task.decisionIds.add(decisionId);
    return signed({ schema: 'forge.verified-outcome-decision.v1', ...record });
  }

  recordContextSelection(input = {}) {
    this.#assertOpen();
    const decisionId = text(input.decisionId, 'decisionId');
    this.#decision(decisionId);
    const selectionId = text(input.selectionId, 'selectionId');
    const key = `${decisionId}:${selectionId}`;
    const receiptSha256 = sha(input.receiptSha256, 'receiptSha256');
    if (this.contextSelections.has(key)) {
      const existing = this.contextSelections.get(key);
      if (existing.receiptSha256 !== receiptSha256) throw new TypeError(`context selection receipt conflict: ${selectionId}`);
      return signed({ schema: 'forge.verified-context-selection-result.v1', decisionId, selectionId, duplicate: true, cardCount: existing.cards.length, receiptSha256Source: receiptSha256 });
    }
    if (!Array.isArray(input.cards) || input.cards.length === 0 || input.cards.length > 1_000) throw new TypeError('cards must contain 1-1000 items');
    const seen = new Set();
    const cards = input.cards.map((item) => {
      const cardId = text(item?.cardId, 'cards[].cardId');
      if (seen.has(cardId)) throw new TypeError(`duplicate context card: ${cardId}`);
      seen.add(cardId);
      return { cardId, tokenCount: integerNonNegative(item?.tokenCount, `card ${cardId} tokenCount`), receiptSha256: sha(item?.receiptSha256, `card ${cardId} receiptSha256`) };
    });
    const record = { decisionId, selectionId, receiptSha256, cards, selectedAtMs: Math.trunc(Number(this.clock())) };
    this.contextSelections.set(key, record);
    return signed({ schema: 'forge.verified-context-selection-result.v1', decisionId, selectionId, duplicate: false, cardCount: cards.length, contextTokensSelected: cards.reduce((sum, item) => sum + item.tokenCount, 0), selectionReceiptSha256: receiptSha256 });
  }

  recordVerification(input = {}) {
    this.#assertOpen();
    const decisionId = text(input.decisionId, 'decisionId');
    const decision = this.#decision(decisionId);
    const verificationId = text(input.verificationId, 'verificationId');
    const status = String(input.status ?? '').trim().toLowerCase();
    if (!VERIFICATION_STATUSES.has(status)) throw new TypeError(`unknown verification status: ${status}`);
    const receiptSha256 = sha(input.receiptSha256, 'receiptSha256');
    const existing = this.verifications.get(verificationId);
    if (existing) {
      if (existing.decisionId !== decisionId || existing.receiptSha256 !== receiptSha256) throw new TypeError(`verification receipt conflict: ${verificationId}`);
      return signed({ schema: 'forge.verified-outcome-verification-result.v1', decisionId, verificationId, status: existing.status, applied: existing.applied, duplicate: true, verificationReceiptSha256: receiptSha256 });
    }
    if (this.verifications.size >= this.maxVerifications) throw new RangeError(`verification capacity exceeded: ${this.maxVerifications}`);
    const task = this.#task(decision.taskId);
    const criterionIds = uniqueSorted((input.verifiedCriterionIds ?? []).map((item) => text(item, 'verifiedCriterionIds[]')));
    for (const criterionId of criterionIds) if (!task.criteria.has(criterionId)) throw new TypeError(`unknown criterion for task ${task.taskId}: ${criterionId}`);
    const independentEvidenceReceiptSha256 = status === 'pass'
      ? sha(input.independentEvidenceReceiptSha256, 'independentEvidenceReceiptSha256')
      : (input.independentEvidenceReceiptSha256 ? sha(input.independentEvidenceReceiptSha256, 'independentEvidenceReceiptSha256') : null);
    const selectedCards = this.#cardsForDecision(decisionId);
    const usefulContext = this.#normalizeContextLinks(input.usefulContext, 'usefulContext', selectedCards);
    const contradictedContext = this.#normalizeContextLinks(input.contradictedContext, 'contradictedContext', selectedCards);
    const overlap = usefulContext.find((item) => contradictedContext.some((other) => other.cardId === item.cardId));
    if (overlap) throw new TypeError(`context card cannot be useful and contradicted: ${overlap.cardId}`);
    const applied = status === 'pass';
    if (applied) {
      for (const criterionId of criterionIds) task.criteria.get(criterionId).verificationReceipts.add(receiptSha256);
      const links = this.contextLinks.get(decisionId) ?? { useful: new Map(), contradicted: new Map() };
      for (const item of usefulContext) links.useful.set(item.cardId, item);
      for (const item of contradictedContext) links.contradicted.set(item.cardId, item);
      this.contextLinks.set(decisionId, links);
    }
    const record = {
      decisionId, verificationId, status, receiptSha256, independentEvidenceReceiptSha256,
      verifiedCriterionIds: criterionIds, usefulContext, contradictedContext, applied,
      verifiedAtMs: Math.trunc(Number(this.clock())),
    };
    this.verifications.set(verificationId, record);
    return signed({ schema: 'forge.verified-outcome-verification-result.v1', decisionId, verificationId, status, applied, duplicate: false, verifiedCriterionIds: criterionIds, verificationReceiptSha256: receiptSha256, independentEvidenceReceiptSha256 });
  }

  recordCost(input = {}) {
    this.#assertOpen();
    const costId = text(input.costId, 'costId');
    const decisionId = text(input.decisionId, 'decisionId');
    this.#decision(decisionId);
    const category = String(input.category ?? '').trim().toLowerCase();
    if (!COST_CATEGORIES.has(category)) throw new TypeError(`unknown cost category: ${category}`);
    const amount = finiteNonNegative(input.amount, 'amount');
    const unit = text(input.unit, 'unit', 64);
    const receiptSha256 = sha(input.receiptSha256, 'receiptSha256');
    const existing = this.costs.get(costId);
    if (existing) {
      if (existing.decisionId !== decisionId || existing.receiptSha256 !== receiptSha256) throw new TypeError(`cost receipt conflict: ${costId}`);
      return signed({ schema: 'forge.verified-outcome-cost-result.v1', costId, decisionId, category: existing.category, duplicate: true, amount: existing.amount, unit: existing.unit, costReceiptSha256: receiptSha256 });
    }
    if (this.costs.size >= this.maxCosts) throw new RangeError(`cost capacity exceeded: ${this.maxCosts}`);
    const record = { costId, decisionId, category, amount, unit, receiptSha256, observedAtMs: Math.trunc(Number(this.clock())) };
    this.costs.set(costId, record);
    return signed({ schema: 'forge.verified-outcome-cost-result.v1', costId, decisionId, category, duplicate: false, amount, unit, costReceiptSha256: receiptSha256 });
  }

  score(scope = {}) {
    const resolved = this.#resolveScope(scope);
    const taskIds = this.#taskIdsForScope(resolved);
    const criteria = taskIds.flatMap((taskId) => [...this.#task(taskId).criteria.values()]);
    const verified = criteria.filter((criterion) => criterion.verificationReceipts.size > 0);
    const totalCriteriaWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    const verifiedCriteriaScore = verified.reduce((sum, criterion) => sum + criterion.weight, 0);
    const base = {
      schema: 'forge.verified-outcome-score.v1', scope: resolved,
      totalCriteriaWeight, verifiedCriteriaScore,
      completionRatio: totalCriteriaWeight > 0 ? verifiedCriteriaScore / totalCriteriaWeight : 0,
      verifiedCriterionIds: uniqueSorted(verified.map((criterion) => criterion.criterionId)),
      contributingVerificationReceipts: uniqueSorted(verified.flatMap((criterion) => [...criterion.verificationReceipts])),
    };
    return signed(base);
  }

  contextUtility(scope = {}) {
    const resolved = this.#resolveScope(scope);
    const decisionIds = this.#decisionIdsForScope(resolved);
    const cards = [];
    const useful = new Set();
    const contradicted = new Set();
    for (const decisionId of decisionIds) {
      for (const item of this.#cardsForDecision(decisionId).values()) cards.push({ ...item, key: `${decisionId}:${item.cardId}` });
      const links = this.contextLinks.get(decisionId);
      for (const cardId of links?.useful?.keys?.() ?? []) useful.add(`${decisionId}:${cardId}`);
      for (const cardId of links?.contradicted?.keys?.() ?? []) contradicted.add(`${decisionId}:${cardId}`);
    }
    const selected = cards.reduce((sum, item) => sum + item.tokenCount, 0);
    const usefulTokens = cards.filter((item) => useful.has(item.key)).reduce((sum, item) => sum + item.tokenCount, 0);
    const contradictedTokens = cards.filter((item) => contradicted.has(item.key)).reduce((sum, item) => sum + item.tokenCount, 0);
    const base = {
      schema: 'forge.verified-context-utility.v1', scope: resolved,
      contextTokensSelected: selected,
      contextTokensActuallyUseful: usefulTokens,
      contextTokensContradicted: contradictedTokens,
      contextTokensUnused: Math.max(0, selected - usefulTokens - contradictedTokens),
      usefulCardIds: uniqueSorted(cards.filter((item) => useful.has(item.key)).map((item) => item.cardId)),
      contradictedCardIds: uniqueSorted(cards.filter((item) => contradicted.has(item.key)).map((item) => item.cardId)),
    };
    return signed(base);
  }

  cost(scope = {}) {
    const resolved = this.#resolveScope(scope);
    const decisionIds = new Set(this.#decisionIdsForScope(resolved));
    const entries = [...this.costs.values()].filter((item) => decisionIds.has(item.decisionId));
    const byCategory = {};
    for (const category of [...COST_CATEGORIES].sort()) {
      const value = entries.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0);
      if (value !== 0) byCategory[category] = value;
    }
    const base = {
      schema: 'forge.verified-outcome-cost-projection.v1', scope: resolved,
      totalObservations: entries.length, byCategory,
      contributingCostReceipts: uniqueSorted(entries.map((item) => item.receiptSha256)),
    };
    return signed(base);
  }

  snapshot() {
    const base = {
      schema: 'forge.verified-outcome-ledger-snapshot.v1', closed: this.closed,
      counts: { missions: this.missions.size, milestones: this.milestones.size, tasks: this.tasks.size, decisions: this.decisions.size, verifications: this.verifications.size, contextSelections: this.contextSelections.size, costs: this.costs.size },
      missionScores: [...this.missions.keys()].sort().map((missionId) => this.score({ missionId })),
      claims: { verifiedValueFromPassingReceiptsOnly: true, contextUsefulnessCallerSupplied: false, costsRequireDecisionId: true, rawPromptsStored: false, chainOfThoughtStored: false },
    };
    return signed(base);
  }

  close() { this.closed = true; return this.snapshot(); }

  #normalizeContextLinks(value, label, selectedCards) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 1_000) throw new TypeError(`${label} must be a bounded array`);
    const seen = new Set();
    return value.map((item) => {
      const cardId = text(item?.cardId, `${label}[].cardId`);
      if (!selectedCards.has(cardId)) throw new TypeError(`unknown context card for decision: ${cardId}`);
      if (seen.has(cardId)) throw new TypeError(`duplicate ${label} card: ${cardId}`);
      seen.add(cardId);
      return {
        cardId,
        reason: label === 'usefulContext' ? text(item?.reason ?? 'verified-effect', `${label}[].reason`, 128) : 'contradicted',
        evidenceReceiptSha256: sha(item?.evidenceReceiptSha256, `${label}[].evidenceReceiptSha256`),
      };
    });
  }

  #cardsForDecision(decisionId) {
    const cards = new Map();
    for (const selection of this.contextSelections.values()) {
      if (selection.decisionId !== decisionId) continue;
      for (const card of selection.cards) {
        const existing = cards.get(card.cardId);
        if (existing && (existing.receiptSha256 !== card.receiptSha256 || existing.tokenCount !== card.tokenCount)) throw new TypeError(`context card identity conflict: ${card.cardId}`);
        cards.set(card.cardId, card);
      }
    }
    return cards;
  }

  #resolveScope(scope) {
    const fields = [['decision', scope.decisionId], ['task', scope.taskId], ['milestone', scope.milestoneId], ['mission', scope.missionId]].filter(([, value]) => value != null);
    if (fields.length !== 1) throw new TypeError('exactly one scope id is required');
    const [type, rawId] = fields[0];
    const id = text(rawId, `${type}Id`);
    if (type === 'decision') this.#decision(id);
    else if (type === 'task') this.#task(id);
    else if (type === 'milestone') this.#milestone(id);
    else this.#mission(id);
    return { type, id };
  }

  #taskIdsForScope(scope) {
    if (scope.type === 'task') return [scope.id];
    if (scope.type === 'decision') return [this.#decision(scope.id).taskId];
    if (scope.type === 'milestone') return [...this.#milestone(scope.id).taskIds];
    return [...this.#mission(scope.id).taskIds];
  }

  #decisionIdsForScope(scope) {
    if (scope.type === 'decision') return [scope.id];
    if (scope.type === 'task') return [...this.#task(scope.id).decisionIds];
    if (scope.type === 'milestone') return [...this.#milestone(scope.id).decisionIds];
    return [...this.#mission(scope.id).decisionIds];
  }

  #mission(id) { const record = this.missions.get(id); if (!record) throw new RangeError(`unknown mission: ${id}`); return record; }
  #milestone(id) { const record = this.milestones.get(id); if (!record) throw new RangeError(`unknown milestone: ${id}`); return record; }
  #task(id) { const record = this.tasks.get(id); if (!record) throw new RangeError(`unknown task: ${id}`); return record; }
  #decision(id) { const record = this.decisions.get(id); if (!record) throw new RangeError(`unknown decision: ${id}`); return record; }
  #assertOpen() { if (this.closed) throw new Error('Verified Outcome Ledger is closed'); }
}
