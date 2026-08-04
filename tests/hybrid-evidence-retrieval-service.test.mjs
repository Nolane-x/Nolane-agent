import test from 'node:test';
import assert from 'node:assert/strict';

import { decomposeEvidenceQuery, HybridEvidenceRetrievalService } from '../src/context/hybrid-evidence-retrieval-service.mjs';

const H = 'a'.repeat(64);

function item(id, source, rankText, extra = {}) {
  return { id, path: `src/${id}.ts`, startLine: 1, endLine: 5, text: rankText, sourceHash: H, confidence: 0.8, source, ...extra };
}

test('query decomposer emits bounded exact, semantic, structural, runtime, historical, and counter queries', () => {
  const queries = decomposeEvidenceQuery('Fix refresh token logout in rotateRefreshToken at src/auth/token.ts after Error: token expired', { hypothesis: 'cookie expiry is the only cause' });
  assert.ok(queries.length <= 12);
  assert.ok(queries.some((entry) => entry.source === 'lexical' && entry.query.includes('rotateRefreshToken')));
  assert.ok(queries.some((entry) => entry.source === 'lexical' && entry.query.includes('src/auth/token.ts')));
  assert.ok(queries.some((entry) => entry.source === 'runtime' && /token expired/i.test(entry.query)));
  assert.ok(queries.some((entry) => entry.source === 'structural'));
  assert.ok(queries.some((entry) => entry.source === 'historical'));
  assert.ok(queries.some((entry) => entry.counterEvidence === true));
  assert.equal(new Set(queries.map((entry) => `${entry.source}:${entry.query}`)).size, queries.length);
});

test('hybrid retrieval fuses five ranked sources with exact reciprocal-rank contribution and counter-evidence', async () => {
  const calls = [];
  const retrievers = {
    lexical: async ({ query }) => { calls.push(['lexical', query]); return [item('shared', 'lexical', 'shared lexical'), item('lex-only', 'lexical', 'lex only')]; },
    semantic: async ({ query }) => { calls.push(['semantic', query]); return [item('shared', 'semantic', 'shared semantic'), item('sem-only', 'semantic', 'semantic only')]; },
    structural: async ({ query }) => { calls.push(['structural', query]); return [item('struct', 'structural', 'caller edge', { graphDistance: 1 })]; },
    runtime: async ({ query, counterEvidence }) => { calls.push(['runtime', query]); return counterEvidence ? [item('counter', 'runtime', 'A passing test contradicts the hypothesis', { polarity: 'counter', runtime: true })] : [item('failure', 'runtime', 'token reused', { runtime: true })]; },
    historical: async ({ query }) => { calls.push(['historical', query]); return [item('history', 'historical', 'previous failed cookie-only fix', { updatedAt: '2026-07-30T00:00:00.000Z' })]; },
  };
  const service = new HybridEvidenceRetrievalService({ version: '2.15.0', retrievers, clock: () => Date.parse('2026-07-30T00:00:00.000Z') });
  const result = await service.retrieve({ projectId: 'p1', principalId: 'u1', query: 'refresh token logout', hypothesis: 'cookie expiry is the only cause', limit: 20, maxQueries: 6 });
  assert.ok(calls.some(([source]) => source === 'lexical'));
  assert.ok(calls.some(([source]) => source === 'semantic'));
  assert.ok(calls.some(([source]) => source === 'structural'));
  assert.ok(calls.some(([source]) => source === 'runtime'));
  assert.ok(calls.some(([source]) => source === 'historical'));
  const shared = result.evidence.find((entry) => entry.key.includes('shared'));
  assert.ok(shared);
  assert.ok(shared.sources.includes('lexical') && shared.sources.includes('semantic'));
  assert.equal(Number(shared.rrfScore.toFixed(12)), Number((2 / 61).toFixed(12)));
  assert.ok(result.counterEvidence.some((entry) => entry.key.includes('counter')));
  assert.ok(result.evidence.some((entry) => entry.runtime === true));
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('hybrid retrieval deduplicates stable locations and penalizes stale evidence', async () => {
  const retrievers = {
    lexical: async () => [item('same', 'lexical', 'fresh', { sourceHash: H, currentHash: H }), item('stale', 'lexical', 'stale', { sourceHash: H, currentHash: 'b'.repeat(64) })],
    semantic: async () => [item('same', 'semantic', 'fresh duplicate', { sourceHash: H, currentHash: H })],
    structural: async () => [], runtime: async () => [], historical: async () => [],
  };
  const service = new HybridEvidenceRetrievalService({ retrievers });
  const result = await service.retrieve({ projectId: 'p1', principalId: 'u1', query: 'same', limit: 10, maxQueries: 1 });
  assert.equal(result.evidence.filter((entry) => entry.path === 'src/same.ts').length, 1);
  const fresh = result.evidence.find((entry) => entry.path === 'src/same.ts');
  const stale = result.evidence.find((entry) => entry.path === 'src/stale.ts');
  assert.ok(fresh.score > stale.score);
  assert.equal(stale.freshness, 'stale');
});

test('hybrid retrieval emits provenance-rich Evidence Cards while preserving legacy fields', async () => {
  const retrievers = {
    lexical: async () => [item('card', 'lexical', 'Authorization: Bearer hidden-value', { symbol: 'validateSession', branch: 'feature/x', worktree: 'wt-1', trust: 0.95, tokenCost: 17, supports: ['h2'] })],
    semantic: async () => [], structural: async () => [], runtime: async () => [], historical: async () => [],
  };
  const service = new HybridEvidenceRetrievalService({ retrievers });
  const result = await service.retrieve({ projectId: 'p1', principalId: 'u1', query: 'validateSession', maxQueries: 1 });
  const card = result.evidence[0];
  assert.match(card.evidenceId, /^ev_[a-f0-9]{32}$/);
  assert.deepEqual(card.lines, [1, 5]);
  assert.equal(card.branch, 'feature/x');
  assert.equal(card.worktree, 'wt-1');
  assert.equal(card.tokenCost, 17);
  assert.equal(card.text.includes('hidden-value'), false);
  assert.equal(card.path, 'src/card.ts');
  assert.equal(card.key.includes('card'), true);
});
