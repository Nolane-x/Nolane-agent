import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEvidence } from '../src/context/context-utility-selector.mjs';
import { RepositoryEvidenceQueryPlanner } from '../src/repository/repository-evidence-query-planner.mjs';

const hash = 'a'.repeat(64);
const card = (id, tokenCost, extra = {}) => ({ evidenceId: id, id, path: `src/${id}.mjs`, lines: [1, 2], sourceHash: hash, text: `${id} evidence`, tokenCost, relevance: 0.9, trust: 0.9, freshness: 'fresh', decisionImpact: 0.9, coverage: 0.8, polarity: 'support', supports: [], contradicts: [], ...extra });
const cited = (stage, id) => ({ id, stage, status: 'fact', score: 0.9, citation: { path: `src/${id}.mjs`, line: 1, sourceHash: hash } });

test('context repository intelligence contract selects useful evidence and executes cited stages in order', async () => {
  const selected = selectEvidence([card('long', 80, { relevance: 0.5 }), card('small', 20)], { budgetTokens: 100, counterEvidenceRatio: 0 });
  assert.equal(selected.selected[0].evidenceId, 'small');
  const calls = [];
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'router', budget: 10, stopWhen: { minCitedResults: 2 } }, {
    exact: async () => { calls.push('exact'); return { cost: 1, results: [cited('exact', 'one')] }; },
    lexical: async () => { calls.push('lexical'); return { cost: 1, results: [cited('lexical', 'two')] }; },
  });
  assert.deepEqual(calls, ['exact', 'lexical']);
  assert.equal(result.citedResults.length, 2);
  assert.equal(result.stoppedEarly, true);
});

test('context repository intelligence contract rejects uncited facts suppresses duplicates and obeys budget exhaustion', async () => {
  const duplicate = selectEvidence([card('a', 20, { text: 'same symbol cache' }), card('b', 20, { text: 'same symbol cache' })], { budgetTokens: 40, counterEvidenceRatio: 0 });
  assert.equal(duplicate.selected.length, 1);
  assert.ok(duplicate.omissions.some((entry) => entry.reason === 'near-duplicate'));
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'x', budget: 1, stopWhen: { minCitedResults: 9 } }, {
    exact: async () => ({ cost: 1, results: [{ id: 'uncited', stage: 'exact', status: 'fact', score: 1 }] }),
    lexical: async () => ({ cost: 1, results: [cited('lexical', 'never')] }),
  });
  assert.equal(result.rejectedResults[0].reason, 'missing-citation');
  assert.equal(result.stopReason, 'budget-exhausted');
});
