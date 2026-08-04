import assert from 'node:assert/strict';
import test from 'node:test';

import { ContextEscalationController } from '../src/context/context-escalation-controller.mjs';

test('ContextEscalationController starts with a bounded initial budget', () => {
  const controller = new ContextEscalationController({ budgets: { initial: 3000, 'symbol-neighborhood': 6000, 'targeted-expansion': 10000, 'full-file-exception': 16000 } });
  const state = controller.start();
  assert.equal(state.stage, 'initial');
  assert.equal(state.budgetTokens, 3000);
  assert.equal(state.expansionCount, 0);
});

test('ContextEscalationController expands only for low confidence or unresolved hypotheses', () => {
  const controller = new ContextEscalationController({ confidenceThreshold: 0.7 });
  const initial = controller.start();
  const stop = controller.evaluate(initial, { confidence: 0.8, unresolvedHypotheses: [] });
  assert.equal(stop.action, 'stop');
  assert.equal(stop.reason, 'confidence-sufficient');
  const low = controller.evaluate(initial, { confidence: 0.4, unresolvedHypotheses: [] });
  assert.equal(low.action, 'expand');
  assert.equal(low.nextState.stage, 'symbol-neighborhood');
  const unresolved = controller.evaluate(initial, { confidence: 0.9, unresolvedHypotheses: ['h2'] });
  assert.equal(unresolved.action, 'expand');
  assert.equal(unresolved.reason, 'unresolved-hypothesis');
});

test('ContextEscalationController is bounded, cancellable and stops at full-file exception', () => {
  const controller = new ContextEscalationController({ maxExpansions: 3 });
  let state = controller.start();
  for (let index = 0; index < 3; index += 1) state = controller.evaluate(state, { confidence: 0.1 }).nextState;
  assert.equal(state.stage, 'full-file-exception');
  assert.equal(controller.evaluate(state, { confidence: 0.1 }).action, 'stop');
  const abort = new AbortController(); abort.abort(new Error('mission cancelled'));
  assert.throws(() => controller.evaluate(controller.start(), { confidence: 0.1, signal: abort.signal }), /mission cancelled/);
});
