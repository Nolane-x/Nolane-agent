import test from 'node:test';
import assert from 'node:assert/strict';
import { RunBudget, BudgetExceededError } from '../src/agent/budget.mjs';

test('run budget records bounded turns tools tokens and elapsed time', () => {
  let now = 100;
  const budget = new RunBudget({ maxTurns: 2, maxToolCalls: 3, maxEstimatedTokens: 50, maxElapsedMs: 1000, now: () => now });
  budget.consumeTurn(); budget.consumeToolCalls(2); budget.consumeTokens(20); now = 150;
  assert.deepEqual(budget.snapshot(), { maxTurns: 2, maxToolCalls: 3, maxEstimatedTokens: 50, maxElapsedMs: 1000, turns: 1, toolCalls: 2, estimatedTokens: 20, elapsedMs: 50 });
});

test('run budget rejects cancellation and exhausted limits', () => {
  const controller = new AbortController();
  const budget = new RunBudget({ maxTurns: 1, maxToolCalls: 1, maxEstimatedTokens: 5, signal: controller.signal });
  budget.consumeTurn();
  assert.throws(() => budget.consumeTurn(), (error) => error instanceof BudgetExceededError && error.kind === 'turn');
  assert.throws(() => budget.consumeTokens(6), /token budget exceeded/i);
  controller.abort();
  assert.throws(() => budget.assertActive(), (error) => error instanceof BudgetExceededError && error.kind === 'cancelled');
});
