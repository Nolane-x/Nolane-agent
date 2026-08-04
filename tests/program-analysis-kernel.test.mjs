import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgramAnalysisKernel } from '../src/intelligence-completion/program-analysis-kernel.mjs';

const S = (c) => c.repeat(64);
const citation = (path, line, c = 'a') => ({ path, startLine: line, endLine: line, sourceHash: S(c) });
const program = {
  repositoryId: 'repo', branch: 'main',
  functions: [
    { id: 'main', entry: 'n1', nodes: [
      { id: 'n1', kind: 'statement', next: ['n2'], reads: [], writes: ['x'], citation: citation('src/main.mjs', 1) },
      { id: 'n2', kind: 'branch', next: ['n3', 'n4'], reads: ['x'], writes: [], citation: citation('src/main.mjs', 2) },
      { id: 'n3', kind: 'call', next: ['n2'], reads: ['x'], writes: [], citation: citation('src/main.mjs', 3) },
      { id: 'n4', kind: 'return', next: [], reads: [], writes: [], citation: citation('src/main.mjs', 4) },
      { id: 'n5', kind: 'statement', next: [], reads: [], writes: ['dead'], citation: citation('src/main.mjs', 5) },
    ], calls: [
      { fromNodeId: 'n3', targetFunctionId: 'helper', dynamic: false, confidence: 1, citation: citation('src/main.mjs', 3) },
      { fromNodeId: 'n2', targetFunctionId: null, dynamic: true, confidence: 0.2, citation: citation('src/main.mjs', 2) },
    ] },
    { id: 'helper', entry: 'h1', nodes: [
      { id: 'h1', kind: 'statement', next: ['h2'], reads: ['x'], writes: ['y'], citation: citation('src/helper.mjs', 1, 'b') },
      { id: 'h2', kind: 'return', next: [], reads: ['y'], writes: [], citation: citation('src/helper.mjs', 2, 'b') },
    ], calls: [] },
  ],
};

test('builds bounded cited control-flow graphs with branches loops unreachable nodes and ambiguous calls', () => {
  const kernel = new ProgramAnalysisKernel();
  const result = kernel.buildControlFlow(program);
  const main = result.functions.find((fn) => fn.functionId === 'main');
  assert.equal(main.entryNodeId, 'n1');
  assert.ok(main.edges.some((edge) => edge.from === 'n2' && edge.to === 'n3' && edge.kind === 'branch'));
  assert.ok(main.edges.some((edge) => edge.from === 'n3' && edge.to === 'n2' && edge.backEdge === true));
  assert.deepEqual(main.unreachableNodeIds, ['n5']);
  assert.ok(result.callEdges.some((edge) => edge.targetFunctionId === 'helper' && edge.ambiguous === false));
  assert.ok(result.callEdges.some((edge) => edge.targetFunctionId === null && edge.ambiguous === true));
  assert.ok(result.functions.every((fn) => fn.nodes.every((node) => node.citation.sourceHash)));
});

test('builds interprocedural data-flow within budgets and keeps unresolved flows explicit', () => {
  const kernel = new ProgramAnalysisKernel({ maximumInterproceduralDepth: 2 });
  const result = kernel.buildDataFlow(program);
  assert.ok(result.edges.some((edge) => edge.symbol === 'x' && edge.fromNodeId === 'n1' && edge.toNodeId === 'n2' && edge.scope === 'intraprocedural'));
  assert.ok(result.edges.some((edge) => edge.symbol === 'x' && edge.fromFunctionId === 'main' && edge.toFunctionId === 'helper' && edge.scope === 'interprocedural'));
  assert.ok(result.edges.some((edge) => edge.symbol === 'y' && edge.fromNodeId === 'h1' && edge.toNodeId === 'h2'));
  assert.ok(result.ambiguousFlows.some((edge) => edge.reason === 'dynamic-call-target-unresolved'));
  assert.equal(result.claims.dynamicTargetsGuessed, false);
});

test('truncates analysis at explicit graph budgets instead of over-consuming resources', () => {
  const kernel = new ProgramAnalysisKernel({ maximumNodes: 3, maximumEdges: 4 });
  const result = kernel.buildControlFlow(program);
  assert.equal(result.truncated, true);
  assert.ok(result.nodeCount <= 3);
  assert.ok(result.edgeCount <= 4);
});
