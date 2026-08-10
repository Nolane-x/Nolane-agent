import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, nextStage, assertTransition } from '../src/core/stages.mjs';

test('workflow has the ForgeOS ordered lifecycle', () => {
  assert.equal(STAGES.length, 14);
  assert.equal(STAGES[0], 'intent');
  assert.equal(STAGES.at(-1), 'released');
});

test('nextStage advances exactly one stage', () => {
  assert.equal(nextStage('intent'), 'discovery');
  assert.equal(nextStage('released'), null);
});

test('assertTransition rejects skipped and backward transitions', () => {
  assert.doesNotThrow(() => assertTransition('research', 'divergence'));
  assert.throws(() => assertTransition('research', 'selection'), /illegal transition/i);
  assert.throws(() => assertTransition('research', 'intent'), /illegal transition/i);
});
