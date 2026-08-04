const FRESHNESS = Object.freeze({ fresh: 1, unknown: 0.72, stale: 0.18 });

function clamp(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}
function tokens(value) {
  const number = Number(value?.tokenCost ?? value?.estimatedTokens ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError('evidence tokenCost must be a finite non-negative number');
  return Math.max(1, Math.ceil(number));
}
function id(value) { return String(value?.evidenceId ?? value?.id ?? value?.key ?? '').trim(); }
function terms(value) {
  return new Set(String(value?.text ?? value?.claim ?? '').toLowerCase().match(/[\p{L}\p{N}_$.-]{3,}/gu) ?? []);
}
function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const term of a) if (b.has(term)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}
function tags(value) {
  const output = new Set();
  for (const item of [value?.symbol, value?.path, value?.source, ...(value?.supports ?? []), ...(value?.contradicts ?? []), ...(value?.coverageTags ?? [])]) {
    const text = String(item ?? '').trim();
    if (text) output.add(text.toLowerCase());
  }
  return output;
}
function baseUtility(value) {
  const relevance = clamp(value?.relevance ?? value?.score ?? value?.confidence ?? 0.5);
  const trust = clamp(value?.trust ?? value?.confidence ?? 0.5);
  const fresh = FRESHNESS[String(value?.freshness ?? 'unknown')] ?? FRESHNESS.unknown;
  const impact = clamp(value?.decisionImpact ?? 0.55);
  const coverage = clamp(value?.coverage ?? 0.5);
  return (100 * relevance * trust * fresh * impact * (0.5 + coverage * 0.5)) / tokens(value);
}
function isCounter(value) { return value?.polarity === 'counter' || (Array.isArray(value?.contradicts) && value.contradicts.length > 0); }
function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

export function selectEvidence(cards, { budgetTokens, counterEvidenceRatio = 0.1, minMarginalUtility = 0, duplicateThreshold = 0.9 } = {}) {
  if (!Array.isArray(cards)) throw new TypeError('cards must be an array');
  const budget = Number(budgetTokens);
  if (!Number.isInteger(budget) || budget <= 0) throw new TypeError('budgetTokens must be a positive integer');
  const counterRatio = Number(counterEvidenceRatio);
  if (!Number.isFinite(counterRatio) || counterRatio < 0 || counterRatio > 0.5) throw new TypeError('counterEvidenceRatio must be between 0 and 0.5');
  const threshold = Number(minMarginalUtility);
  if (!Number.isFinite(threshold) || threshold < 0) throw new TypeError('minMarginalUtility must be non-negative');

  const omissions = [];
  const ranked = cards.map((card, index) => ({ card, index, id: id(card) || `anonymous-${index}`, cost: tokens(card), base: baseUtility(card), terms: terms(card), tags: tags(card) }))
    .sort((a, b) => b.base - a.base || a.id.localeCompare(b.id));

  const unique = [];
  for (const candidate of ranked) {
    const duplicate = unique.find((kept) => {
      if (candidate.id === kept.id) return true;
      if (candidate.card?.sourceHash && kept.card?.sourceHash && candidate.card.sourceHash === kept.card.sourceHash
          && String(candidate.card?.path ?? '') === String(kept.card?.path ?? '')
          && String(candidate.card?.lines ?? candidate.card?.startLine ?? '') === String(kept.card?.lines ?? kept.card?.startLine ?? '')) return true;
      return jaccard(candidate.terms, kept.terms) >= duplicateThreshold;
    });
    if (duplicate) {
      omissions.push(Object.freeze({ id: candidate.id, reason: 'near-duplicate', duplicateOf: duplicate.id, tokenCost: candidate.cost }));
      continue;
    }
    unique.push(candidate);
  }

  const selected = [];
  const covered = new Set();
  let usedTokens = 0;

  function marginal(candidate) {
    let maxSimilarity = 0;
    for (const chosen of selected) maxSimilarity = Math.max(maxSimilarity, jaccard(candidate.terms, chosen.terms));
    let newTags = 0;
    for (const tag of candidate.tags) if (!covered.has(tag)) newTags += 1;
    const coverageGain = candidate.tags.size ? newTags / candidate.tags.size : 0.5;
    const novelty = 1 - maxSimilarity;
    return candidate.base * (0.55 + 0.45 * novelty) * (1 + 0.25 * coverageGain);
  }

  function chooseFrom(pool, tokenLimit = budget) {
    let chosen = null;
    let chosenScore = -1;
    for (const candidate of pool) {
      if (candidate.selected || usedTokens + candidate.cost > budget || candidate.cost > tokenLimit) continue;
      const score = marginal(candidate);
      if (score > chosenScore || (score === chosenScore && candidate.id.localeCompare(chosen?.id ?? '') < 0)) {
        chosen = candidate;
        chosenScore = score;
      }
    }
    if (!chosen || chosenScore < threshold) return null;
    chosen.selected = true;
    chosen.selectedUtility = chosenScore;
    selected.push(chosen);
    usedTokens += chosen.cost;
    for (const tag of chosen.tags) covered.add(tag);
    return chosen;
  }

  const counterTarget = Math.floor(budget * counterRatio);
  const counters = unique.filter((candidate) => isCounter(candidate.card));
  let counterEvidenceTokens = 0;
  while (counterEvidenceTokens < counterTarget) {
    const chosen = chooseFrom(counters, Math.max(counterTarget - counterEvidenceTokens, ...counters.filter((item) => !item.selected).map((item) => item.cost), 0));
    if (!chosen) break;
    counterEvidenceTokens += chosen.cost;
  }

  while (true) {
    const chosen = chooseFrom(unique);
    if (!chosen) break;
    if (isCounter(chosen.card)) counterEvidenceTokens += chosen.cost;
  }

  for (const candidate of unique) {
    if (candidate.selected) continue;
    const score = marginal(candidate);
    omissions.push(Object.freeze({ id: candidate.id, reason: usedTokens + candidate.cost > budget ? 'budget-exceeded' : score < threshold ? 'marginal-utility-below-threshold' : 'not-selected', tokenCost: candidate.cost, marginalUtility: score }));
  }

  selected.sort((a, b) => b.selectedUtility - a.selectedUtility || a.id.localeCompare(b.id));
  return frozen({
    schema: 'forge.context-utility-selection.v1',
    budgetTokens: budget,
    usedTokens,
    remainingTokens: budget - usedTokens,
    counterEvidenceRatio: counterRatio,
    counterEvidenceTokens,
    selected: selected.map((item) => item.card),
    selectedUtility: selected.map((item) => item.selectedUtility),
    omissions,
  });
}
