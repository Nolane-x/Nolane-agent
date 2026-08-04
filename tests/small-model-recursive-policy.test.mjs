import test from 'node:test';
import assert from 'node:assert/strict';
import { RecursivePolicySidecar } from '../src/small-model/recursive-policy-sidecar.mjs';
import { RecursiveGraphSolverPack } from '../src/small-model/recursive-graph-solver-pack.mjs';

test('RecursivePolicySidecar enforces fixed-memory recurrent state and stores only a latent hash', () => {
  const sidecar = new RecursivePolicySidecar({ stateSize: 3, minDepth: 2, maxDepth: 6 });
  assert.throws(() => sidecar.run({ initialState: [0, 0], policy: () => ({ state: [0, 0] }) }), /state size/i);
  const result = sidecar.run({
    initialState: [0, 0, 0], taskDifficulty: 0.5,
    policy: ({ state, depth }) => ({ state: depth === 1 ? [1, 0, 0] : state, action: { type: 'test' }, confidence: 0.95, progress: 1 }),
  });
  assert.equal(result.haltingReason, 'converged');
  assert.equal(result.depth, 2);
  assert.equal('finalState' in result, false);
  assert.match(result.latentStateSha256, /^[a-f0-9]{64}$/);
});

test('RecursivePolicySidecar detects collapse and falls back to a non-looped policy', () => {
  const sidecar = new RecursivePolicySidecar({ stateSize: 2, minDepth: 2, maxDepth: 8, collapsePatience: 2 });
  const result = sidecar.run({
    initialState: [0, 0], taskDifficulty: 1,
    policy: ({ state }) => ({ state, action: null, confidence: 0.1, progress: 0 }),
    fallback: () => ({ type: 'fallback-plan', parameters: { safe: true } }),
  });
  assert.equal(result.haltingReason, 'collapse');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.action.type, 'fallback-plan');
});

test('RecursivePolicySidecar allocates dynamic depth and forbids general-intelligence claims from puzzle-only results', () => {
  const sidecar = new RecursivePolicySidecar({ stateSize: 2, minDepth: 2, maxDepth: 10 });
  assert.equal(sidecar.depthBudget({ taskDifficulty: 0 }), 2);
  assert.equal(sidecar.depthBudget({ taskDifficulty: 1 }), 10);
  assert.equal(sidecar.depthBudget({ taskDifficulty: 0.5 }), 6);
  const puzzle = sidecar.certifyBenchmark({ domains: ['arc', 'sudoku'], passed: true });
  assert.equal(puzzle.claimAllowed, false);
  assert.match(puzzle.reason, /puzzle-only/i);
  const coding = sidecar.certifyBenchmark({ domains: ['repository-coding', 'arc'], passed: true });
  assert.equal(coding.claimAllowed, true);
});

test('RecursiveGraphSolverPack solves bounded reachability and dependency order with receipts', () => {
  const pack = new RecursiveGraphSolverPack({ maxNodes: 20 });
  pack.register({ id: 'repo', nodes: ['a', 'b', 'c', 'd'], edges: [['a', 'b'], ['b', 'c'], ['a', 'd']] });
  const reach = pack.reachability({ graphId: 'repo', from: 'a', to: 'c' });
  assert.equal(reach.reachable, true);
  assert.deepEqual(reach.path, ['a', 'b', 'c']);
  const order = pack.topologicalOrder({ graphId: 'repo' });
  assert.equal(order.cyclic, false);
  assert.equal(order.order.indexOf('a') < order.order.indexOf('c'), true);
  assert.match(reach.receiptSha256, /^[a-f0-9]{64}$/);
});

test('RecursiveGraphSolverPack rejects cyclic topological plans and graph overflow', () => {
  const pack = new RecursiveGraphSolverPack({ maxNodes: 3 });
  assert.throws(() => pack.register({ id: 'big', nodes: ['a', 'b', 'c', 'd'], edges: [] }), /node budget/i);
  pack.register({ id: 'cycle', nodes: ['a', 'b'], edges: [['a', 'b'], ['b', 'a']] });
  const result = pack.topologicalOrder({ graphId: 'cycle' });
  assert.equal(result.cyclic, true);
  assert.deepEqual(result.order, []);
});
