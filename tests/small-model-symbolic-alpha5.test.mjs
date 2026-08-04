import test from 'node:test';
import assert from 'node:assert/strict';
import { AstCodemodEngine } from '../src/small-model/ast-codemod-engine.mjs';
import { FiniteDomainSmtAdapter, DatalogAdapter } from '../src/small-model/constraint-adapters.mjs';
import { SymbolicSolverCompiler } from '../src/small-model/symbolic-solver-compiler.mjs';

const SHA = 'a'.repeat(64);

test('AstCodemodEngine renames code identifiers without changing strings or comments and preserves syntax balance', () => {
  const engine = new AstCodemodEngine();
  const source = `// oldName stays in comment\nconst oldName = 1;\nconst text = "oldName stays in string";\nexport { oldName };\nconsole.log(oldName);\n`;
  const result = engine.apply({
    language: 'javascript',
    source,
    operations: [{ op: 'rename-identifier', from: 'oldName', to: 'newName', scope: 'program' }],
  });
  assert.match(result.output, /const newName = 1/);
  assert.match(result.output, /export \{ newName \}/);
  assert.match(result.output, /console\.log\(newName\)/);
  assert.match(result.output, /\/\/ oldName stays in comment/);
  assert.match(result.output, /"oldName stays in string"/);
  assert.equal(result.parse.valid, true);
  assert.equal(result.changedTokens, 3);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('AstCodemodEngine rewrites import sources and rejects shadowed all-scope identifier rewrites', () => {
  const engine = new AstCodemodEngine();
  const importResult = engine.apply({
    language: 'javascript',
    source: `import value from './old.js';\nexport { value } from './old.js';\nconst text = './old.js';\n`,
    operations: [{ op: 'rewrite-import-source', from: './old.js', to: './new.js' }],
  });
  assert.equal((importResult.output.match(/\.\/new\.js/g) ?? []).length, 2);
  assert.match(importResult.output, /const text = '\.\/old\.js'/);
  assert.throws(() => engine.apply({
    language: 'javascript',
    source: `const item = 1; function f(item) { return item; } console.log(item);`,
    operations: [{ op: 'rename-identifier', from: 'item', to: 'entry', scope: 'all' }],
  }), /shadowed|ambiguous/i);
});

test('AstCodemodEngine rejects invalid identifiers and unbalanced JavaScript', () => {
  const engine = new AstCodemodEngine();
  assert.throws(() => engine.apply({ language: 'javascript', source: 'const x = {', operations: [{ op: 'rename-identifier', from: 'x', to: 'y', scope: 'program' }] }), /unbalanced/i);
  assert.throws(() => engine.apply({ language: 'javascript', source: 'const x = 1;', operations: [{ op: 'rename-identifier', from: 'x', to: 'not-valid!', scope: 'program' }] }), /identifier/i);
});

test('FiniteDomainSmtAdapter returns deterministic SAT and UNSAT proof receipts within state budgets', () => {
  const adapter = new FiniteDomainSmtAdapter({ maxStates: 100 });
  const sat = adapter.solve({
    variables: { x: [1, 2, 3], y: [1, 2, 3] },
    constraints: [
      { op: 'lt', left: { var: 'x' }, right: { var: 'y' } },
      { op: 'eq', left: { var: 'y' }, right: { value: 3 } },
    ],
  });
  assert.equal(sat.status, 'sat');
  assert.deepEqual(sat.model, { x: 1, y: 3 });
  assert.equal(sat.statesExplored > 0, true);
  const unsat = adapter.solve({ variables: { x: [1, 2] }, constraints: [{ op: 'eq', left: { var: 'x' }, right: { value: 3 } }] });
  assert.equal(unsat.status, 'unsat');
  assert.match(unsat.proofSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => new FiniteDomainSmtAdapter({ maxStates: 2 }).solve({ variables: { x: [1, 2], y: [1, 2] }, constraints: [] }), /state budget/i);
});

test('DatalogAdapter evaluates bounded positive and stratified-negation rules', () => {
  const adapter = new DatalogAdapter({ maxIterations: 20, maxFacts: 100 });
  const result = adapter.evaluate({
    facts: [
      { predicate: 'parent', args: ['alice', 'bob'] },
      { predicate: 'parent', args: ['bob', 'cara'] },
      { predicate: 'blocked', args: ['mallory'] },
      { predicate: 'person', args: ['alice'] },
      { predicate: 'person', args: ['mallory'] },
    ],
    rules: [
      { head: { predicate: 'ancestor', args: ['?x', '?y'] }, body: [{ predicate: 'parent', args: ['?x', '?y'] }] },
      { head: { predicate: 'ancestor', args: ['?x', '?z'] }, body: [{ predicate: 'parent', args: ['?x', '?y'] }, { predicate: 'ancestor', args: ['?y', '?z'] }] },
      { head: { predicate: 'allowed', args: ['?x'] }, body: [{ predicate: 'person', args: ['?x'] }, { predicate: 'blocked', args: ['?x'], negated: true }] },
    ],
    query: { predicate: 'ancestor', args: ['alice', '?who'] },
  });
  assert.deepEqual(result.answers.map((item) => item['?who']).sort(), ['bob', 'cara']);
  assert.deepEqual(result.facts.filter((fact) => fact.predicate === 'allowed').map((fact) => fact.args[0]), ['alice']);
  assert.equal(result.converged, true);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('DatalogAdapter rejects unsafe variables and recursive negation', () => {
  const adapter = new DatalogAdapter();
  assert.throws(() => adapter.evaluate({ facts: [], rules: [{ head: { predicate: 'p', args: ['?x'] }, body: [{ predicate: 'q', args: ['fixed'] }] }] }), /unsafe variable/i);
  assert.throws(() => adapter.evaluate({
    facts: [{ predicate: 'seed', args: ['a'] }],
    rules: [
      { head: { predicate: 'p', args: ['?x'] }, body: [{ predicate: 'seed', args: ['?x'] }, { predicate: 'q', args: ['?x'], negated: true }] },
      { head: { predicate: 'q', args: ['?x'] }, body: [{ predicate: 'seed', args: ['?x'] }, { predicate: 'p', args: ['?x'], negated: true }] },
    ],
  }), /stratified|negation/i);
});

test('SymbolicSolverCompiler registers AST, SMT and Datalog adapters with verified provenance', () => {
  const compiler = new SymbolicSolverCompiler();
  const ast = compiler.registerAdapter({ id: 'ast-js', version: '1', kind: 'ast-codemod', implementation: new AstCodemodEngine(), receiptSha256: SHA });
  const smt = compiler.registerAdapter({ id: 'finite-smt', version: '1', kind: 'smt', implementation: new FiniteDomainSmtAdapter(), receiptSha256: SHA });
  const datalog = compiler.registerAdapter({ id: 'datalog', version: '1', kind: 'datalog', implementation: new DatalogAdapter(), receiptSha256: SHA });
  assert.deepEqual([ast.kind, smt.kind, datalog.kind], ['ast-codemod', 'smt', 'datalog']);
  assert.equal(compiler.snapshot().adapters, 3);
  assert.throws(() => compiler.registerAdapter({ id: 'bad', version: '1', kind: 'smt', implementation: {}, receiptSha256: 'bad' }), /receipt/i);
});
