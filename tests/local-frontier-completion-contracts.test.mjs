import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalFrontierCompletionPlane } from '../src/frontier-completion/local-frontier-completion-plane.mjs';

test('local frontier completion contract lazily exposes bounded runtimes with content receipts', () => {
  const plane = new LocalFrontierCompletionPlane();
  assert.equal(plane.snapshot().lifecycle.productSecurityExperienceLoaded, false);
  const receipt = plane.productSecurityExperience.artifacts.record({ journeyId: 'contract', before: Buffer.from('a'), after: Buffer.from('b'), frames: [] });
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(plane.snapshot().lifecycle.productSecurityExperienceLoaded, true);
  assert.equal(plane.snapshot().claims.localCompletionEvidenceOnly, true);
});

test('local frontier completion contract rejects use after close and keeps competitor claims locked', () => {
  const plane = new LocalFrontierCompletionPlane();
  const closed = plane.close();
  assert.equal(closed.claims.competitorComparisonCertified, false);
  assert.throws(() => plane.contextSemantic, /closed/i);
  assert.throws(() => plane.benchmark, /closed/i);
});
