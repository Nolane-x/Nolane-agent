import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAssertionEvidenceBindings } from '../scripts/generate-assertion-evidence-bindings.mjs';

test('assertion evidence generator binds only requirements with real positive and negative test evidence', async () => {
  const result = await generateAssertionEvidenceBindings({ root: process.cwd(), write: false });
  assert.equal(result.coverage.summary.requirementsTotal, 48);
  assert.equal(result.coverage.summary.requirementsBound, 48);
  assert.equal(result.coverage.summary.requirementsUnbound, 0);
  assert.equal(result.bindings.every((item) => item.positiveAssertions.length > 0 && item.negativeAssertions.length > 0), true);
  assert.equal(result.bindings.every((item) => item.productionEntrypoints.every((entry) => !entry.startsWith('docs/'))), true);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});
