import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextLearningKernel } from '../src/intelligence-completion/context-learning-kernel.mjs';

const H = (c) => c.repeat(64);

test('expands queries from exact task signals with provenance and counter evidence', async () => {
  const kernel = new ContextLearningKernel({
    dependencyNeighbors: async () => [{ symbol: 'parseConfig', path: 'src/config.mjs', relation: 'calls' }],
    gitSignals: async () => [{ path: 'src/app.mjs', commit: 'a'.repeat(40), kind: 'recent-change' }],
    testSignals: async () => [{ testId: 'config rejects null', path: 'tests/config.test.mjs' }],
  });
  const result = await kernel.expandQueries({
    taskType: 'bugfix', objective: 'Fix parseConfig after TypeError: cannot read properties of null',
    symbols: ['parseConfig'], stackFrames: [{ symbol: 'loadConfig', path: 'src/config.mjs', line: 42 }],
    hypothesis: 'null reaches parseConfig', maxQueries: 20,
  });
  assert.equal(result.schema, 'forge.context-query-expansion.v1');
  assert.ok(result.queries.some((q) => q.kind === 'symbol' && q.query === 'parseConfig'));
  assert.ok(result.queries.some((q) => q.kind === 'stack' && q.query.includes('loadConfig')));
  assert.ok(result.queries.some((q) => q.kind === 'test' && q.query.includes('config rejects null')));
  assert.ok(result.queries.some((q) => q.kind === 'git' && q.query.includes('src/app.mjs')));
  assert.ok(result.queries.some((q) => q.kind === 'dependency' && q.query.includes('parseConfig')));
  assert.ok(result.queries.some((q) => q.counterEvidence === true));
  assert.equal(new Set(result.queries.map((q) => `${q.kind}:${q.query.toLowerCase()}`)).size, result.queries.length);
});

test('learns evidence utility only from verified outcomes', () => {
  const kernel = new ContextLearningKernel();
  kernel.recordVerifiedOutcome({ taskType: 'bugfix', evidenceType: 'stack', useful: true, verified: false, verificationStatus: 'passed', verificationReceiptSha256: H('a') });
  assert.equal(kernel.rankEvidenceTypes({ taskType: 'bugfix' }).scores.stack, 0);
  kernel.recordVerifiedOutcome({ taskType: 'bugfix', evidenceType: 'stack', useful: true, verified: true, verificationStatus: 'passed', verificationReceiptSha256: H('b') });
  kernel.recordVerifiedOutcome({ taskType: 'bugfix', evidenceType: 'semantic', useful: false, verified: true, verificationStatus: 'passed', verificationReceiptSha256: H('c') });
  const ranking = kernel.rankEvidenceTypes({ taskType: 'bugfix' });
  assert.ok(ranking.scores.stack > ranking.scores.semantic);
  assert.equal(ranking.claims.unverifiedOutcomesChangedLearning, false);
});

test('ablation replay classifies required unnecessary and inconclusive evidence', async () => {
  const kernel = new ContextLearningKernel();
  const cards = [
    { cardId: 'required', tokenCost: 10 },
    { cardId: 'extra', tokenCost: 20 },
    { cardId: 'unstable', tokenCost: 5 },
  ];
  const verificationContractSha256 = H('d');
  const result = await kernel.runAblationReplay({
    verificationContractSha256, evidenceCards: cards,
    verifier: async ({ evidenceCards: remaining, removedCardId, verificationContractSha256: contract }) => {
      assert.equal(contract, verificationContractSha256);
      if (removedCardId === 'unstable') throw new Error('runner unavailable');
      return { verificationStatus: 'passed', verified: true, score: remaining.some((c) => c.cardId === 'required') ? 10 : 3, verificationReceiptSha256: H(removedCardId === null ? 'e' : removedCardId === 'required' ? 'f' : '1') };
    },
  });
  assert.equal(result.baselineScore, 10);
  assert.equal(result.items.find((x) => x.cardId === 'required').classification, 'required');
  assert.equal(result.items.find((x) => x.cardId === 'extra').classification, 'unnecessary');
  assert.equal(result.items.find((x) => x.cardId === 'unstable').classification, 'inconclusive');
  assert.equal(result.claims.contextDeletedAutomatically, false);
});
