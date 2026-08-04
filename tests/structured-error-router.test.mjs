import test from 'node:test';
import assert from 'node:assert/strict';
import { StructuredErrorRouter } from '../src/cognition/structured-error-router.mjs';

const router = new StructuredErrorRouter({ ownerThreshold: 0.2 });

test('routes missing binary to execution without rewriting unrelated subsystems', () => {
  const result = router.route({ category: 'missing-binary', code: 'ENOENT', operation: 'start-language-server' });
  assert.equal(result.primarySubsystem, 'execution');
  assert.deepEqual(result.ownerMask, ['execution']);
  assert.ok(result.errorPosterior.execution > 0.7);
});

test('routes stale symbol memory to memory and context', () => {
  const result = router.route({ category: 'stale-symbol-memory', sourceHashMatches: false, symbolExists: false });
  assert.equal(result.primarySubsystem, 'memory');
  assert.deepEqual(new Set(result.ownerMask), new Set(['memory', 'context']));
});

test('routes green tests with unmet criteria to causal model and goal', () => {
  const result = router.route({ category: 'criteria-unmet', testsPassed: true, verifiedCriteriaRatio: 0.4 });
  assert.equal(result.primarySubsystem, 'causalModel');
  assert.ok(result.ownerMask.includes('goal'));
  assert.equal(result.ownerMask.includes('execution'), false);
});

test('rejects private payloads', () => {
  assert.throws(() => router.route({ category: 'timeout', rawPrompt: 'private' }), /forbidden/i);
});
