import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryEvidenceQueryPlanner } from '../src/repository/repository-evidence-query-planner.mjs';

const HASH = 'a'.repeat(64);
const cited = (stage, id, overrides = {}) => ({
  id, stage, status: 'fact', score: 0.9,
  citation: { path: `src/${id}.mjs`, line: 1, sourceHash: HASH },
  ...overrides,
});

test('RepositoryEvidenceQueryPlanner plans stages in the exact required order', () => {
  const planner = new RepositoryEvidenceQueryPlanner();
  const plan = planner.plan({ query: 'validateSession', budget: 80 });
  assert.deepEqual(plan.stages.map((stage) => stage.id), ['exact','lexical','ast-lsp','graph','git','test','semantic','runtime']);
  assert.equal(plan.budget, 80);
  assert.ok(plan.stages.every((stage) => stage.maxCost > 0));
  assert.match(plan.planSha256, /^[a-f0-9]{64}$/);
});

test('RepositoryEvidenceQueryPlanner executes providers in order and propagates remaining budget', async () => {
  const calls = [];
  const providers = Object.fromEntries(['exact','lexical','ast-lsp','graph','git','test','semantic','runtime'].map((stage) => [stage, async ({ remainingBudget }) => {
    calls.push([stage, remainingBudget]);
    return { cost: 3, results: [cited(stage, stage)] };
  }]));
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'session', budget: 40, stopWhen: { minCitedResults: 99 } }, providers);
  assert.deepEqual(calls.map(([stage]) => stage), ['exact','lexical','ast-lsp','graph','git','test','semantic','runtime']);
  assert.deepEqual(calls.map(([, budget]) => budget), [40,37,34,31,28,25,22,19]);
  assert.equal(result.remainingBudget, 16);
  assert.equal(result.citedResults.length, 8);
  assert.equal(result.stoppedEarly, false);
});

test('RepositoryEvidenceQueryPlanner records unavailable stages instead of pretending they returned no matches', async () => {
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'session', budget: 12 }, {
    exact: async () => ({ cost: 1, results: [cited('exact', 'session')] }),
    graph: async () => ({ cost: 1, results: [] }),
  });
  assert.deepEqual(result.stages.filter((stage) => stage.status === 'unavailable').map((stage) => stage.id), ['lexical','ast-lsp','git','test','semantic','runtime']);
  assert.equal(result.stages.find((stage) => stage.id === 'graph').status, 'complete');
});

test('RepositoryEvidenceQueryPlanner stops only after cited fact threshold is met', async () => {
  const calls = [];
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'session', budget: 20, stopWhen: { minCitedResults: 2, minScore: 0.8 } }, {
    exact: async () => { calls.push('exact'); return { cost: 2, results: [cited('exact', 'one')] }; },
    lexical: async () => { calls.push('lexical'); return { cost: 2, results: [cited('lexical', 'two')] }; },
    'ast-lsp': async () => { calls.push('ast-lsp'); return { cost: 2, results: [cited('ast-lsp', 'three')] }; },
  });
  assert.deepEqual(calls, ['exact','lexical']);
  assert.equal(result.stoppedEarly, true);
  assert.equal(result.stopReason, 'acceptance-threshold-met');
  assert.equal(result.citedResults.length, 2);
});

test('RepositoryEvidenceQueryPlanner separates ambiguous and uncited results from facts', async () => {
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'dynamic call', budget: 10, stopWhen: { minCitedResults: 1 } }, {
    exact: async () => ({ cost: 1, results: [
      cited('exact', 'ambiguous', { status: 'ambiguous', candidates: ['a','b'] }),
      { id: 'uncited', stage: 'exact', status: 'fact', score: 1 },
    ] }),
    lexical: async () => ({ cost: 1, results: [cited('lexical', 'verified')] }),
  });
  assert.equal(result.ambiguousResults.length, 1);
  assert.equal(result.rejectedResults[0].reason, 'missing-citation');
  assert.deepEqual(result.citedResults.map((item) => item.id), ['verified']);
  assert.equal(result.stages.find((stage) => stage.id === 'exact').acceptedCount, 0);
});

test('RepositoryEvidenceQueryPlanner stops before a provider when budget is exhausted', async () => {
  const calls = [];
  const result = await new RepositoryEvidenceQueryPlanner().execute({ query: 'session', budget: 2, stopWhen: { minCitedResults: 99 } }, {
    exact: async () => { calls.push('exact'); return { cost: 2, results: [] }; },
    lexical: async () => { calls.push('lexical'); return { cost: 1, results: [] }; },
  });
  assert.deepEqual(calls, ['exact']);
  assert.equal(result.stopReason, 'budget-exhausted');
  assert.equal(result.remainingBudget, 0);
});
