import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactGraph, invalidateDownstream } from '../src/core/graph.mjs';

const artifacts = [
  { id: 'a', consumes: [], state: 'verified' },
  { id: 'b', consumes: ['a'], state: 'verified' },
  { id: 'c', consumes: ['b'], state: 'verified' },
  { id: 'd', consumes: ['a'], state: 'verified' },
];

test('artifact graph exposes deterministic descendants', () => {
  const graph = buildArtifactGraph(artifacts);
  assert.deepEqual(graph.descendants('a'), ['b','c','d']);
  assert.deepEqual(graph.ancestors('c'), ['a','b']);
});

test('artifact graph rejects dependency cycles', () => {
  assert.throws(() => buildArtifactGraph([{ id: 'a', consumes: ['b'] }, { id: 'b', consumes: ['a'] }]), /cycle/i);
});

test('upstream changes invalidate only downstream artifacts', () => {
  const next = invalidateDownstream(artifacts, ['a'], 'decision changed', '2026-07-24T00:00:00.000Z');
  assert.equal(next.find((x) => x.id === 'a').state, 'verified');
  for (const id of ['b','c','d']) assert.equal(next.find((x) => x.id === id).state, 'invalidated');
});
