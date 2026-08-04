import test from 'node:test';
import assert from 'node:assert/strict';
import { SymbolicSolverCompiler } from '../src/small-model/symbolic-solver-compiler.mjs';
import { SolverSandbox } from '../src/small-model/solver-sandbox.mjs';

test('SymbolicSolverCompiler induces a typed declarative solver from verified episodes', () => {
  const compiler = new SymbolicSolverCompiler();
  assert.throws(() => compiler.induce({ id: 'rename', version: '1', episodes: [{ id: 'e1', verified: false }], definition: {} }), /verified/i);
  const solver = compiler.induce({
    id: 'rename', version: '1',
    episodes: [{ id: 'e1', verified: true, receiptSha256: 'a'.repeat(64) }, { id: 'e2', verified: true, receiptSha256: 'b'.repeat(64) }],
    definition: {
      inputType: 'source-text', outputType: 'source-text', kind: 'text-rewrite',
      operations: [{ op: 'replace-exact', from: 'oldName', to: 'newName', maxReplacements: 2 }],
      soundnessScope: ['exact-token-rename'], knownIncompleteness: ['does-not-parse-comments'],
    },
  });
  assert.equal(solver.definition.kind, 'text-rewrite');
  assert.match(solver.solverSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(solver.provenance.episodeIds, ['e1', 'e2']);
});

test('SolverSandbox executes bounded AST/codemod-style declarations without eval or shell', () => {
  const sandbox = new SolverSandbox({ maxInputBytes: 100, maxOperations: 3 });
  const result = sandbox.execute({
    solver: {
      id: 'rename', version: '1', definition: { kind: 'text-rewrite', operations: [{ op: 'replace-exact', from: 'oldName', to: 'newName', maxReplacements: 1 }] },
    },
    input: 'const oldName = oldName + 1;',
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.output, 'const newName = oldName + 1;');
  assert.throws(() => sandbox.execute({ solver: { id: 'bad', version: '1', definition: { kind: 'javascript', source: 'process.exit()' } }, input: 'x' }), /declarative/i);
  assert.equal(result.executedSource, false);
});

test('SymbolicSolverCompiler generates deterministic property cases and checks transfer', () => {
  const compiler = new SymbolicSolverCompiler();
  const casesA = compiler.generateProperties({ seed: 7, count: 5, schema: { x: { type: 'integer', min: 1, max: 3 }, enabled: { type: 'boolean' } } });
  const casesB = compiler.generateProperties({ seed: 7, count: 5, schema: { x: { type: 'integer', min: 1, max: 3 }, enabled: { type: 'boolean' } } });
  assert.deepEqual(casesA, casesB);
  const transfer = compiler.gateTransfer({ solverId: 's1', sourceDomain: 'repo-a', heldOut: [{ repositoryId: 'repo-b', tuned: false, passed: true }] });
  assert.equal(transfer.allowed, true);
  assert.throws(() => compiler.gateTransfer({ solverId: 's1', sourceDomain: 'repo-a', heldOut: [{ repositoryId: 'repo-a', tuned: false, passed: true }] }), /held-out/i);
});

test('SymbolicSolverCompiler checks composition by typed interfaces and write conflicts', () => {
  const compiler = new SymbolicSolverCompiler();
  const safe = compiler.checkComposition({ solvers: [
    { id: 'a', definition: { inputType: 'source-text', outputType: 'source-text', writes: ['file:a'] } },
    { id: 'b', definition: { inputType: 'source-text', outputType: 'report', writes: ['report:b'] } },
  ] });
  assert.equal(safe.allowed, true);
  const unsafe = compiler.checkComposition({ solvers: [
    { id: 'a', definition: { inputType: 'source-text', outputType: 'source-text', writes: ['file:a'] } },
    { id: 'b', definition: { inputType: 'report', outputType: 'report', writes: ['file:a'] } },
  ] });
  assert.equal(unsafe.allowed, false);
  assert.deepEqual([...unsafe.findings].sort(), ['type-mismatch:a->b', 'write-conflict:file:a']);
});

test('SymbolicSolverCompiler versions, rolls back and measures amortized value', () => {
  const compiler = new SymbolicSolverCompiler();
  const make = (version, to) => compiler.induce({
    id: 'rename', version, episodes: [{ id: `e${version}`, verified: true, receiptSha256: String(version).repeat(64).slice(0, 64) }],
    definition: { inputType: 'source-text', outputType: 'source-text', kind: 'text-rewrite', operations: [{ op: 'replace-exact', from: 'x', to }], soundnessScope: ['exact'], knownIncompleteness: [] },
  });
  make('1', 'y'); make('2', 'z');
  compiler.recordValue({ solverId: 'rename', tokensSaved: 100, buildCost: 40, executionCost: 5 });
  compiler.recordValue({ solverId: 'rename', tokensSaved: 50, buildCost: 0, executionCost: 5 });
  const value = compiler.amortizedValue('rename');
  assert.equal(value.netValue, 100);
  assert.equal(compiler.rollback('rename').version, '1');
});

test('SymbolicSolverCompiler falls back to a model when a solver abstains', () => {
  const compiler = new SymbolicSolverCompiler();
  const result = compiler.executeWithFallback({
    solver: () => ({ status: 'abstain', reason: 'outside-scope' }),
    modelFallback: () => ({ status: 'generated', patch: 'safe' }),
  });
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.result.status, 'generated');
});
