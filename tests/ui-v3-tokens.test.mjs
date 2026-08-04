import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUiTokens, contrastRatio } from '../scripts/validate-ui-tokens.mjs';

test('Quiet Authority token graph has no undefined variables, cycles or raw colors outside primitives', async () => {
  const report = await validateUiTokens({ root: 'ui-v3/styles' });
  assert.deepEqual(report.undefinedVariables, []);
  assert.deepEqual(report.cycles, []);
  assert.deepEqual(report.rawColorsOutsidePrimitives, []);
  assert.equal(report.layers.primitive > 0, true);
  assert.equal(report.layers.semantic > 0, true);
  assert.equal(report.layers.component > 0, true);
});

test('primary text, secondary text and focus fixtures meet WCAG AA contrast', () => {
  assert.ok(contrastRatio('#eef1f5', '#0d0f12') >= 4.5);
  assert.ok(contrastRatio('#a7afbb', '#0d0f12') >= 4.5);
  assert.ok(contrastRatio('#a79cff', '#0d0f12') >= 4.5);
});
