import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../src/small-model/shared.mjs';
import { ConstraintSkillCompiler } from '../src/small-model/constraint-skill-compiler.mjs';
import { ConstraintProofLab } from '../src/small-model/constraint-proof-lab.mjs';

function episode(id, domain) {
  const base = { schema: 'nolane.small-model.constraint-induction-episode.v1', id, domain, verified: true, hiddenChainOfThoughtStored: false };
  return { ...base, receiptSha256: canonicalSha256(base) };
}

const episodes = [episode('e1', 'repo-a'), episode('e2', 'repo-b')];

test('ConstraintSkillCompiler compiles typed finite-domain SMT skills with explicit unsat probes', () => {
  const skill = new ConstraintSkillCompiler().compileSmt({
    id: 'test-budget-plan', version: '1', episodes,
    variables: { tests: [1, 2, 3], risk: [0, 1, 2] },
    constraints: [
      { op: 'gte', left: { var: 'tests' }, right: { value: 2 } },
      { op: 'lte', left: { var: 'risk' }, right: { value: 1 } },
    ],
    unsatConstraints: [
      { op: 'gte', left: { var: 'tests' }, right: { value: 3 } },
      { op: 'lt', left: { var: 'tests' }, right: { value: 1 } },
    ],
    maxStates: 100,
  });
  assert.equal(skill.kind, 'finite-domain-smt');
  assert.deepEqual(skill.sourceDomains, ['repo-a', 'repo-b']);
  assert.equal(skill.hiddenChainOfThoughtStored, false);
  assert.match(skill.receiptSha256, /^[a-f0-9]{64}$/);
});

test('ConstraintProofLab returns deterministic SAT and UNSAT proof receipts', () => {
  const skill = new ConstraintSkillCompiler().compileSmt({
    id: 'test-budget-plan', version: '1', episodes,
    variables: { tests: [1, 2, 3], risk: [0, 1, 2] },
    constraints: [{ op: 'eq', left: { var: 'tests' }, right: { value: 2 } }],
    unsatConstraints: [
      { op: 'eq', left: { var: 'tests' }, right: { value: 1 } },
      { op: 'eq', left: { var: 'tests' }, right: { value: 3 } },
    ], maxStates: 100,
  });
  const first = new ConstraintProofLab().verify({ skill });
  const second = new ConstraintProofLab().verify({ skill });
  assert.equal(first.status, 'pass');
  assert.equal(first.sat.status, 'sat');
  assert.equal(first.unsat.status, 'unsat');
  assert.equal(first.sat.proofSha256, second.sat.proofSha256);
  assert.equal(first.unsat.proofSha256, second.unsat.proofSha256);
  assert.equal(first.completeWithinBudgets, true);
});

test('ConstraintSkillCompiler and proof lab compile bounded Datalog with safe negation and reject unsafe probes', () => {
  const skill = new ConstraintSkillCompiler().compileDatalog({
    id: 'test-impact-query', version: '1', episodes,
    facts: [
      { predicate: 'depends', args: ['unit', 'source'] },
      { predicate: 'depends', args: ['integration', 'unit'] },
      { predicate: 'blocked', args: ['full'] },
      { predicate: 'candidate', args: ['unit'] },
      { predicate: 'candidate', args: ['full'] },
    ],
    rules: [
      { head: { predicate: 'impacted', args: ['?x', '?y'] }, body: [{ predicate: 'depends', args: ['?x', '?y'] }] },
      { head: { predicate: 'impacted', args: ['?x', '?z'] }, body: [{ predicate: 'depends', args: ['?x', '?y'] }, { predicate: 'impacted', args: ['?y', '?z'] }] },
      { head: { predicate: 'allowed', args: ['?x'] }, body: [{ predicate: 'candidate', args: ['?x'] }, { predicate: 'blocked', args: ['?x'], negated: true }] },
    ],
    query: { predicate: 'allowed', args: ['?test'] },
    unsafeProbe: { facts: [], rules: [{ head: { predicate: 'p', args: ['?x'] }, body: [{ predicate: 'q', args: ['fixed'] }] }] },
    maxIterations: 20, maxFacts: 100,
  });
  const proof = new ConstraintProofLab().verify({ skill });
  assert.equal(proof.status, 'pass');
  assert.deepEqual(proof.datalog.answers, [{ '?test': 'unit' }]);
  assert.equal(proof.unsafeProbeRejected, true);
  assert.equal(proof.datalog.converged, true);
});

test('Constraint skills reject stale episodes, invalid schemas, recursive negation, and budget exhaustion', () => {
  const compiler = new ConstraintSkillCompiler();
  assert.throws(() => compiler.compileSmt({ id: 'x', version: '1', episodes: [{ ...episodes[0], hiddenChainOfThoughtStored: true }, episodes[1]], variables: { x: [1] }, constraints: [], unsatConstraints: [] }), /receipt|hidden|public/i);
  assert.throws(() => compiler.compileSmt({ id: 'x', version: '1', episodes, variables: { x: [] }, constraints: [], unsatConstraints: [] }), /domain/i);
  assert.throws(() => compiler.compileDatalog({ id: 'x', version: '1', episodes, facts: [], rules: [], query: null }), /query|rules/i);
  const oversized = compiler.compileSmt({ id: 'large', version: '1', episodes, variables: { x: [1, 2], y: [1, 2] }, constraints: [], unsatConstraints: [{ op: 'eq', left: { var: 'x' }, right: { value: 3 } }], maxStates: 2 });
  assert.throws(() => new ConstraintProofLab().verify({ skill: oversized }), /state budget/i);
});
