import test from 'node:test';
import assert from 'node:assert/strict';
import { PolyglotIntelligencePlane } from '../src/repository/polyglot-intelligence-plane.mjs';

test('PolyglotIntelligencePlane is lazy, exposes honest capability status, and activates on first evidence operation', async () => {
  const plane = new PolyglotIntelligencePlane({ commandProbe: async (command) => ({ available: ['clangd','sourcekit-lsp'].includes(command), version: command === 'clangd' ? '18.1' : command === 'sourcekit-lsp' ? '6.0' : null }) });
  const before = await plane.status();
  assert.equal(before.lifecycle, 'inactive');
  assert.equal(before.languages.find((x) => x.id === 'typescript').parser.status, 'operated');
  assert.equal(before.languages.find((x) => x.id === 'python').lsp.status, 'external-gate');
  assert.equal(before.languages.find((x) => x.id === 'c').lsp.status, 'operated');
  const classified = plane.classifySource('src/app.ts');
  assert.equal(classified.kind, 'source');
  assert.equal((await plane.status()).lifecycle, 'active');
  await plane.close();
});

test('PolyglotIntelligencePlane fuses runtime evidence and evaluates drift without guessing ambiguity', async () => {
  const plane = new PolyglotIntelligencePlane();
  plane.fuse({ source: 'lsp', edges: [{ from: 'a', to: null, relation: 'calls', ambiguousTargets: ['b','c'], confidence: 0.5, provenance: { path: 'a.ts', line: 1, sourceSha256: 'a'.repeat(64) } }] });
  plane.observeRuntime({ projectId: 'p', taskId: 't', kind: 'call', sourceSymbolId: 'a', targetSymbolId: 'b', payload: { token: 'secret' } });
  const graph = plane.graph();
  assert.ok(graph.edges.some((x) => x.ambiguous && x.guessed === false));
  assert.ok(graph.edges.some((x) => x.relation === 'runtime-calls'));
  const drift = plane.evaluateDrift({ modules: [{ id: 'a', layer: 'ui' }, { id: 'b', layer: 'storage' }], dependencies: [{ from: 'a', to: 'b', confidence: 1 }], layerRules: [{ from: 'ui', deny: ['storage'] }] });
  assert.equal(drift.blocked, true);
  await plane.close();
});
