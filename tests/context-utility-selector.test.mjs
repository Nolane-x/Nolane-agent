import assert from 'node:assert/strict';
import test from 'node:test';

import { selectEvidence } from '../src/context/context-utility-selector.mjs';

function card(id, tokenCost, extra = {}) {
  return {
    evidenceId: id, id, path: `src/${id}.mjs`, lines: [1, 5], sourceHash: id.padEnd(64, 'a').slice(0, 64),
    text: `${id} evidence`, tokenCost, relevance: 0.8, trust: 0.9, freshness: 'fresh', decisionImpact: 0.8,
    coverage: 0.7, polarity: 'support', supports: [], contradicts: [], ...extra,
  };
}

test('selectEvidence prefers high decision value per token over long low-value context', () => {
  const small = card('small', 10, { relevance: 0.95, decisionImpact: 0.95 });
  const long = card('long', 90, { relevance: 0.75, decisionImpact: 0.5 });
  const result = selectEvidence([long, small], { budgetTokens: 100, counterEvidenceRatio: 0 });
  assert.equal(result.selected[0].evidenceId, 'small');
  assert.ok(result.selectedUtility[0] > result.selectedUtility[1]);
  assert.equal(result.usedTokens, 100);
});

test('selectEvidence suppresses near duplicates and rewards new coverage', () => {
  const first = card('first', 20, { text: 'validate session cache expiration milliseconds', symbol: 'validateSession', supports: ['h1'] });
  const duplicate = card('duplicate', 20, { text: 'validate session cache expiration milliseconds', symbol: 'validateSession', supports: ['h1'], relevance: 0.99 });
  const novel = card('novel', 20, { text: 'integration test exercises cache invalidation event', symbol: 'sessionIntegrationTest', supports: ['h2'] });
  const result = selectEvidence([duplicate, novel, first], { budgetTokens: 60, counterEvidenceRatio: 0 });
  assert.equal(result.selected.some((item) => item.evidenceId === 'novel'), true);
  assert.equal(result.selected.filter((item) => ['first', 'duplicate'].includes(item.evidenceId)).length, 1);
  assert.ok(result.omissions.some((item) => item.reason === 'near-duplicate'));
});

test('selectEvidence reserves budget for counter evidence', () => {
  const supportA = card('support-a', 45, { relevance: 1, decisionImpact: 1 });
  const supportB = card('support-b', 45, { relevance: 0.95, decisionImpact: 0.95 });
  const counter = card('counter', 20, { polarity: 'counter', contradicts: ['h1'], relevance: 0.7, decisionImpact: 0.9 });
  const result = selectEvidence([supportA, supportB, counter], { budgetTokens: 100, counterEvidenceRatio: 0.2 });
  assert.equal(result.selected.some((item) => item.evidenceId === 'counter'), true);
  assert.ok(result.counterEvidenceTokens >= 20);
  assert.ok(result.usedTokens <= 100);
});

test('selectEvidence stops when marginal utility is below threshold and tie-breaks deterministically', () => {
  const a = card('a', 20, { relevance: 0.1, decisionImpact: 0.1 });
  const b = card('b', 20, { relevance: 0.1, decisionImpact: 0.1 });
  const first = selectEvidence([b, a], { budgetTokens: 100, minMarginalUtility: 1 });
  const second = selectEvidence([a, b], { budgetTokens: 100, minMarginalUtility: 1 });
  assert.deepEqual(first.selected.map((item) => item.evidenceId), second.selected.map((item) => item.evidenceId));
  assert.equal(first.selected.length, 0);
});
