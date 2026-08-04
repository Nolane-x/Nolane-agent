import { validateScoreVector } from './contracts.mjs';
import { mechanismFingerprint, ideaSimilarity as compareIdeas } from './idea-fingerprint.mjs';
import { assertPrincipal, principalRecord } from './principals.mjs';

const WEIGHTS = Object.freeze({
  novelty: 0.20,
  usefulness: 0.20,
  feasibility: 0.15,
  leverage: 0.10,
  defensibility: 0.10,
  testability: 0.10,
  clarity: 0.075,
  evidence: 0.075,
});

export const fingerprintIdea = mechanismFingerprint;
export const ideaSimilarity = compareIdeas;

export function scoreIdea(idea, vector, { principal, rubricVersion = 'creativity-v1', now = new Date().toISOString() } = {}) {
  const evaluator = assertPrincipal(principal);
  const values = validateScoreVector({ ...vector, ideaId: idea.id });
  const total = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + values[key] * weight, 0);
  return {
    ...values,
    ideaSha256: idea.sha256,
    evaluator: principalRecord(evaluator),
    rubricVersion: String(rubricVersion || 'creativity-v1').trim().slice(0, 100),
    scoredAt: now,
    total: Math.round(total * 100) / 100,
  };
}

export function clusterIdeas(ideas, { threshold = 0.62 } = {}) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new TypeError('cluster threshold must be between 0 and 1');
  const parents = ideas.map((_, index) => index);
  const find = (index) => parents[index] === index ? index : (parents[index] = find(parents[index]));
  const unite = (left, right) => { const a = find(left); const b = find(right); if (a !== b) parents[b] = a; };
  for (let left = 0; left < ideas.length; left += 1) {
    for (let right = left + 1; right < ideas.length; right += 1) {
      if (compareIdeas(ideas[left], ideas[right]) >= threshold) unite(left, right);
    }
  }
  const groups = new Map();
  ideas.forEach((idea, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, { fingerprint: idea.fingerprint ?? mechanismFingerprint(idea), ideaIds: [], representative: idea.id, similarities: {} });
    const group = groups.get(root);
    group.ideaIds.push(idea.id);
    group.similarities[idea.id] = Math.round(compareIdeas(ideas[root], idea) * 1000) / 1000;
  });
  return [...groups.values()];
}

export function rankIdeas(scores) {
  return [...scores].sort((a, b) => b.total - a.total || String(a.ideaId).localeCompare(String(b.ideaId)));
}
