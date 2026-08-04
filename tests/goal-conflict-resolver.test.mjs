import test from 'node:test';
import assert from 'node:assert/strict';

import { GoalConflictResolver } from '../src/construction/goal-conflict-resolver.mjs';

test('never chooses an option that violates a hard constraint', () => {
  const resolver = new GoalConflictResolver();
  const result = resolver.resolve({
    hardConstraints: [{ constraintId: 'api-stable', rule: 'preserve-public-api' }],
    negotiableGoals: [{ goalId: 'speed', weight: 2 }, { goalId: 'memory', weight: 1 }],
    options: [
      { optionId: 'fast-break', satisfies: ['speed'], violates: ['api-stable'], tradeoffs: { speed: 10, memory: 8 } },
      { optionId: 'adapter', satisfies: ['api-stable', 'speed'], violates: [], tradeoffs: { speed: 7, memory: 6 } },
    ],
  });
  assert.equal(result.selectedOptionId, 'adapter');
  assert.equal(result.rejectedOptions.find((item) => item.optionId === 'fast-break').reason, 'hard-constraint-violation');
});

test('uses negotiable goal scores only among compliant options', () => {
  const resolver = new GoalConflictResolver();
  const result = resolver.resolve({
    hardConstraints: [{ constraintId: 'tests', rule: 'tests-must-pass' }],
    negotiableGoals: [{ goalId: 'speed', weight: 2 }, { goalId: 'memory', weight: 1 }],
    options: [
      { optionId: 'a', satisfies: ['tests'], violates: [], tradeoffs: { speed: 5, memory: 8 } },
      { optionId: 'b', satisfies: ['tests'], violates: [], tradeoffs: { speed: 8, memory: 3 } },
    ],
  });
  assert.equal(result.selectedOptionId, 'b');
});
