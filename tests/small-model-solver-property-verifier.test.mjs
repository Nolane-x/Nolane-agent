import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyFiniteSmtProperties,
  verifyBoundedDatalogProperties,
  verifySolverPropertyReceipt,
} from '../src/small-model/solver-property-verifier.mjs';

test('finite SMT property verifier matches independent reference enumeration across seeded SAT and UNSAT cases', () => {
  const result = verifyFiniteSmtProperties({ seeds: [7, 19, 41], casesPerSeed: 8, budgets: { maxStates: 128 } });
  assert.equal(result.status, 'pass');
  assert.equal(result.trials, 24);
  assert.equal(result.counterexamples.length, 0);
  assert.equal(result.satCases > 0, true);
  assert.equal(result.unsatCases > 0, true);
  assert.equal(result.referenceAgreement, true);
  assert.equal(result.hiddenChainOfThoughtStored, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(verifySolverPropertyReceipt(result).receiptSha256, result.receiptSha256);
});

test('bounded Datalog property verifier matches independent transitive closure across seeded graphs', () => {
  const result = verifyBoundedDatalogProperties({ seeds: [3, 11, 29], casesPerSeed: 6, budgets: { maxIterations: 64, maxFacts: 256 } });
  assert.equal(result.status, 'pass');
  assert.equal(result.trials, 18);
  assert.equal(result.counterexamples.length, 0);
  assert.equal(result.referenceAgreement, true);
  assert.equal(result.convergedCases, 18);
  assert.equal(result.hiddenChainOfThoughtStored, false);
});

test('solver property verification is deterministic and rejects tamper or insufficient budgets', () => {
  const first = verifyFiniteSmtProperties({ seeds: [5], casesPerSeed: 4, budgets: { maxStates: 128 } });
  const second = verifyFiniteSmtProperties({ seeds: [5], casesPerSeed: 4, budgets: { maxStates: 128 } });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.throws(() => verifySolverPropertyReceipt({ ...first, trials: first.trials + 1 }), /hash|receipt/i);
  assert.throws(() => verifyFiniteSmtProperties({ seeds: [1], casesPerSeed: 1, budgets: { maxStates: 2 } }), /budget/i);
  assert.throws(() => verifyBoundedDatalogProperties({ seeds: [1], casesPerSeed: 1, budgets: { maxIterations: 1, maxFacts: 2 } }), /budget/i);
});
