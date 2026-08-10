import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/core/constants.mjs';
import { nextStage, assertTransition } from '../src/core/stages.mjs';
import { createHash } from 'node:crypto';

test('stage transition invariant holds for every stage', () => {
  for (let i = 0; i < STAGES.length; i += 1) {
    const expected = STAGES[i + 1] ?? null;
    assert.equal(nextStage(STAGES[i]), expected);
    if (expected) assert.equal(assertTransition(STAGES[i], expected), true);
  }
});

test('random invalid stage jumps are rejected deterministically', () => {
  let seed = 1729;
  const random = () => { seed = (seed * 48271) % 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 200; i += 1) {
    const fromIndex = Math.floor(random() * (STAGES.length - 1));
    let toIndex = Math.floor(random() * STAGES.length);
    if (toIndex === fromIndex + 1) toIndex = (toIndex + 2) % STAGES.length;
    assert.throws(() => assertTransition(STAGES[fromIndex], STAGES[toIndex]), /illegal transition/i);
  }
  assert.equal(createHash('sha256').update(String(seed)).digest('hex').length, 64);
});
