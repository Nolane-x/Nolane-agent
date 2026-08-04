import test from 'node:test';
import assert from 'node:assert/strict';

import { selectVerificationStages } from '../src/construction/test-impact-selector.mjs';

test('orders targeted tests before wider stages for isolated internal changes', () => {
  const result = selectVerificationStages({
    changedSymbols: ['normalizeExpiry'], graphEdges: [{ from: 'normalizeExpiry', to: 'validateSession', relation: 'called-by' }],
    relatedTests: [{ testId: 'session-unit', symbolIds: ['normalizeExpiry'] }, { testId: 'auth-integration', symbolIds: ['validateSession'] }],
    risk: 'low', semanticFindings: [],
  });
  assert.equal(result.stages[0].kind, 'syntax-type');
  assert.equal(result.stages[1].kind, 'targeted');
  assert.ok(result.stages[1].testIds.includes('session-unit'));
  assert.equal(result.stages.some((item) => item.kind === 'full-suite'), false);
});

test('requires wider verification for public API, schema and security changes', () => {
  const result = selectVerificationStages({ changedSymbols: ['api'], graphEdges: [], relatedTests: [], risk: 'high', semanticFindings: [{ kind: 'breaking-public-api' }, { kind: 'schema-change' }, { kind: 'permission-expansion' }] });
  assert.ok(result.stages.some((item) => item.kind === 'integration'));
  assert.ok(result.stages.some((item) => item.kind === 'mutation-probe'));
  assert.ok(result.stages.some((item) => item.kind === 'full-suite'));
  assert.ok(result.stages.some((item) => item.kind === 'security'));
});
