import test from 'node:test';
import assert from 'node:assert/strict';

import { VerificationPyramidPlanner } from '../src/verification/verification-pyramid-planner.mjs';

test('keeps a low-risk internal change on the narrow verification path', () => {
  const planner = new VerificationPyramidPlanner();
  const plan = planner.plan({
    risk: 'low',
    changedSymbols: ['normalizeExpiry'],
    semanticFindings: [],
    impactedTests: ['session-unit'],
    criterionIds: ['criterion-session-expiry'],
    runtimeSurfaces: [],
  });
  assert.deepEqual(plan.stages.map((stage) => stage.kind), ['parse-type', 'targeted']);
  assert.equal(plan.stages.every((stage) => stage.reason.length > 0), true);
  assert.equal(plan.omissions.some((item) => item.kind === 'full-suite' && item.reason.length > 0), true);
  assert.equal(plan.claims.commandsExecuted, false);
});

test('requires the full verification pyramid for public auth hot-path changes', () => {
  const planner = new VerificationPyramidPlanner();
  const plan = planner.plan({
    risk: 'critical',
    changedSymbols: ['authenticateRequest'],
    semanticFindings: [
      { kind: 'breaking-public-api' },
      { kind: 'permission-expansion' },
      { kind: 'security-critical-scope' },
      { kind: 'hot-path-change' },
    ],
    impactedTests: ['auth-unit', 'api-contract'],
    historicalFailures: ['auth-regression'],
    criterionIds: ['criterion-auth', 'criterion-compat'],
    runtimeSurfaces: ['api'],
  });
  const kinds = plan.stages.map((stage) => stage.kind);
  for (const expected of ['parse-type', 'targeted', 'contract', 'integration', 'api-journey', 'mutation-probe', 'performance', 'security', 'independent-review', 'full-suite']) {
    assert.ok(kinds.includes(expected), `missing ${expected}`);
  }
  assert.equal(plan.stages.every((stage) => Array.isArray(stage.criterionIds)), true);
  assert.equal(plan.omissions.some((item) => item.required === true), false);
});
