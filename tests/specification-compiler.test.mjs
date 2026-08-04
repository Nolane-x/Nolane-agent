import test from 'node:test';
import assert from 'node:assert/strict';

import { compileSpecification } from '../src/construction/specification-compiler.mjs';

test('compiles a bounded specification with weighted criteria and invariant contracts', () => {
  const compiled = compileSpecification({
    specificationId: 'spec-session',
    goal: 'Add session expiration',
    criteria: [{ criterionId: 'c1', statement: 'Expired sessions are rejected', weight: 4 }],
    nonGoals: ['Rewrite authentication'],
    constraints: [{ constraintId: 'api-stable', kind: 'hard', statement: 'Public API must remain compatible', rule: 'preserve-public-api' }],
    interfaces: [{ interfaceId: 'validate-session', path: 'src/session.mjs', compatibility: 'preserve' }],
    invariants: [{ invariantId: 'no-token-log', severity: 'critical', statement: 'Tokens are never logged', verifierId: 'secret-scan' }],
    affectedComponents: ['session'],
    verificationPlan: [{ verificationId: 'test-expiration', criterionIds: ['c1'], kind: 'test' }],
  });

  assert.equal(compiled.status, 'ready');
  assert.equal(compiled.criteria[0].weight, 4);
  assert.equal(compiled.conflicts.length, 0);
  assert.ok(compiled.receiptSha256);
  assert.ok(Object.isFrozen(compiled));
  assert.ok(Object.isFrozen(compiled.criteria));
});

test('blocks contradictory hard requirements before edit authorization', () => {
  const compiled = compileSpecification({
    specificationId: 'spec-rename',
    goal: 'Rename public session validation API',
    criteria: [{ criterionId: 'c1', statement: 'Rename validateSession to verifySession', weight: 4 }],
    constraints: [
      { constraintId: 'api-stable', kind: 'hard', statement: 'Public API must remain unchanged', rule: 'preserve-public-api' },
      { constraintId: 'rename-api', kind: 'hard', statement: 'Rename public API without a compatibility adapter', rule: 'rename-public-api-without-adapter' },
    ],
    verificationPlan: [{ verificationId: 'api-test', criterionIds: ['c1'], kind: 'test' }],
  });

  assert.equal(compiled.status, 'blocked');
  assert.equal(compiled.editAuthorized, false);
  assert.equal(compiled.conflicts[0].kind, 'hard-constraint-conflict');
  assert.ok(compiled.conflicts[0].receiptSha256);
});
