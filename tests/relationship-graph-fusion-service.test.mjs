import test from 'node:test';
import assert from 'node:assert/strict';
import { RelationshipGraphFusionService } from '../src/repository/relationship-graph-fusion-service.mjs';

test('RelationshipGraphFusionService merges exact AST/LSP/build/test/runtime edges with provenance and preserves ambiguity', () => {
  const g = new RelationshipGraphFusionService();
  g.ingest({ source: 'ast', nodes: [{ id: 'sym-a', kind: 'function', name: 'a' }, { id: 'sym-b', kind: 'function', name: 'b' }], edges: [{ from: 'sym-a', to: 'sym-b', relation: 'calls', confidence: 0.96, provenance: { path: 'src/a.ts', line: 3, sourceSha256: 'a'.repeat(64) } }] });
  g.ingest({ source: 'lsp', nodes: [{ id: 'sym-c', kind: 'function', name: 'c' }], edges: [{ from: 'sym-a', to: null, relation: 'calls', confidence: 0.51, ambiguousTargets: ['sym-b', 'sym-c'], provenance: { path: 'src/a.ts', line: 4, sourceSha256: 'a'.repeat(64) } }] });
  g.ingest({ source: 'test', edges: [{ from: 'test-a', to: 'sym-a', relation: 'verifies', confidence: 1, provenance: { path: 'tests/a.test.ts', line: 1, sourceSha256: 'b'.repeat(64) } }] });
  const snap = g.snapshot();
  assert.equal(snap.edges.length, 3);
  assert.equal(snap.edges.find((x) => x.ambiguous).guessed, false);
  assert.deepEqual(snap.edges.find((x) => x.ambiguous).ambiguousTargets, ['sym-b', 'sym-c']);
  assert.ok(snap.edges.every((x) => x.provenance.sourceSha256));
  assert.match(snap.receiptSha256, /^[a-f0-9]{64}$/);
});

test('RelationshipGraphFusionService deduplicates identical evidence but keeps independent provenance', () => {
  const g = new RelationshipGraphFusionService();
  const edge = { from: 'a', to: 'b', relation: 'imports', confidence: 1, provenance: { path: 'a.ts', line: 1, sourceSha256: 'c'.repeat(64) } };
  g.ingest({ source: 'ast', edges: [edge, edge] });
  assert.equal(g.snapshot().edges.length, 1);
});
