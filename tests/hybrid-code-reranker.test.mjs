import assert from 'node:assert/strict';
import test from 'node:test';

import { HybridCodeReranker } from '../src/repository/hybrid-code-reranker.mjs';

test('HybridCodeReranker prioritizes symbol definitions and graph evidence over lexical distractors', () => {
  const reranker = new HybridCodeReranker();
  const result = reranker.rank('validate session expiration', [
    { chunkId: 'distractor', path: 'docs/session.md', startLine: 1, semantic: 0.72, lexical: 1, pathScore: 0.4, symbolMatch: 0, graph: 0, freshness: 1, feedback: 0, testRelation: 0 },
    { chunkId: 'definition', path: 'src/session.mjs', startLine: 20, semantic: 0.82, lexical: 0.55, pathScore: 0.2, symbolMatch: 1, definition: true, graph: 0.7, freshness: 1, feedback: 0, testRelation: 0.2 },
    { chunkId: 'caller', path: 'src/auth.mjs', startLine: 9, semantic: 0.78, lexical: 0.35, pathScore: 0, symbolMatch: 0.7, graph: 0.5, freshness: 1, feedback: 0, testRelation: 0 },
  ], { provider: { id: 'neural', degraded: false } });
  assert.equal(result[0].chunkId, 'definition');
  assert.ok(result[0].scoreBreakdown.symbol > 0);
  assert.equal(result[0].providerId, 'neural');
  assert.equal(result[0].degraded, false);
});

test('HybridCodeReranker keeps deterministic lexical fallback and stable ties', () => {
  const reranker = new HybridCodeReranker();
  const candidates = [
    { chunkId: 'b', path: 'b.mjs', startLine: 1, semantic: 0, lexical: 0.8, pathScore: 0, symbolMatch: 0, graph: 0, freshness: 1, feedback: 0, testRelation: 0 },
    { chunkId: 'a', path: 'a.mjs', startLine: 1, semantic: 0, lexical: 0.8, pathScore: 0, symbolMatch: 0, graph: 0, freshness: 1, feedback: 0, testRelation: 0 },
  ];
  const result = reranker.rank('query', candidates, { provider: { id: 'forge-feature-hash-v1', degraded: true } });
  assert.deepEqual(result.map((item) => item.chunkId), ['a', 'b']);
  assert.equal(result[0].degraded, true);
  assert.equal(result[0].scoreBreakdown.semanticWeight < 0.55, true);
});
