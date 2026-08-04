import test from 'node:test';
import assert from 'node:assert/strict';

import { LocalFrontierCompletionPlane } from '../src/frontier-completion/local-frontier-completion-plane.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

test('local frontier completion plane lazy-loads only requested completion runtimes and closes cleanly', () => {
  const plane = new LocalFrontierCompletionPlane();
  const before = plane.snapshot();
  assert.deepEqual(before.lifecycle, {
    closed: false,
    contextSemanticLoaded: false,
    polyglotLoaded: false,
    memoryResourceCollaborationLoaded: false,
    productSecurityExperienceLoaded: false,
    benchmarkLoaded: false,
  });
  const artifacts = plane.productSecurityExperience.artifacts.record({ journeyId: 'j1', before: Buffer.from('a'), after: Buffer.from('b'), frames: [] });
  assert.match(artifacts.receiptSha256, /^[a-f0-9]{64}$/);
  const after = plane.snapshot();
  assert.equal(after.lifecycle.productSecurityExperienceLoaded, true);
  assert.equal(after.lifecycle.contextSemanticLoaded, false);
  assert.equal(plane.close().lifecycle.closed, true);
  assert.throws(() => plane.benchmark, /closed/i);
});

test('Decision Plane exposes Local Frontier Completion lazily without app composition', () => {
  const plane = new DecisionPlane();
  assert.equal(plane.snapshot().lifecycle.localFrontierCompletionLoaded, false);
  const benchmark = plane.localFrontierCompletion.benchmark.pack;
  assert.equal(typeof benchmark.createPublicSuite, 'function');
  assert.equal(plane.snapshot().lifecycle.localFrontierCompletionLoaded, true);
  assert.equal(plane.localFrontierCompletionSnapshot().lifecycle.benchmarkLoaded, true);
  plane.close();
});
