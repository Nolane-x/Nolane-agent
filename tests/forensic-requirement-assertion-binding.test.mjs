import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTestAssertionIndex } from '../src/forensics/test-assertion-index.mjs';
import { validateRequirementAssertionBindings } from '../src/forensics/requirement-assertion-binding.mjs';

const source = `
import test from 'node:test';
import assert from 'node:assert/strict';
test('allows bounded read action', () => {
  assert.equal('allow', 'allow');
});
test('rejects missing scope', () => {
  assert.throws(() => { throw new Error('missing scope'); }, /missing scope/);
});
`;

function index() {
  return buildTestAssertionIndex([{ path: 'tests/runtime-contract.test.mjs', source }]);
}

test('requirement assertion bindings require exact positive and negative named tests', () => {
  const value = validateRequirementAssertionBindings({
    requirementId: 'MASTER-EXAMPLE',
    bindings: [{
      testPath: 'tests/runtime-contract.test.mjs',
      positiveTestNames: ['allows bounded read action'],
      negativeTestNames: ['rejects missing scope'],
    }],
    testIndex: index(),
  });
  assert.equal(value.status, 'verified');
  assert.equal(value.bindings[0].positiveTests[0].name, 'allows bounded read action');
  assert.equal(value.bindings[0].negativeTests[0].name, 'rejects missing scope');
});

test('requirement assertion bindings reject stale names and wrong test paths', () => {
  assert.throws(() => validateRequirementAssertionBindings({
    requirementId: 'MASTER-EXAMPLE',
    bindings: [{ testPath: 'tests/missing.test.mjs', positiveTestNames: ['allows bounded read action'], negativeTestNames: ['rejects missing scope'] }],
    testIndex: index(),
  }), /not indexed/i);
  assert.throws(() => validateRequirementAssertionBindings({
    requirementId: 'MASTER-EXAMPLE',
    bindings: [{ testPath: 'tests/runtime-contract.test.mjs', positiveTestNames: ['unknown positive'], negativeTestNames: ['rejects missing scope'] }],
    testIndex: index(),
  }), /unknown positive/i);
});

test('requirement assertion bindings reject positive/negative role inversion', () => {
  assert.throws(() => validateRequirementAssertionBindings({
    requirementId: 'MASTER-EXAMPLE',
    bindings: [{ testPath: 'tests/runtime-contract.test.mjs', positiveTestNames: ['rejects missing scope'], negativeTestNames: ['allows bounded read action'] }],
    testIndex: index(),
  }), /positive test.*negative evidence/i);
});

test('requirement assertion bindings reject hidden reasoning metadata', () => {
  assert.throws(() => validateRequirementAssertionBindings({
    requirementId: 'MASTER-EXAMPLE',
    bindings: [{
      testPath: 'tests/runtime-contract.test.mjs',
      positiveTestNames: ['allows bounded read action'],
      negativeTestNames: ['rejects missing scope'],
      hiddenReasoning: 'do not store this',
    }],
    testIndex: index(),
  }), /hidden reasoning/i);
});

import { auditMasterLedgerAssertions } from '../src/forensics/master-ledger-assertion-audit.mjs';

test('explicit requirement bindings remain dedicated even when a test file has many owners', () => {
  const testPath = 'tests/runtime-contract.test.mjs';
  const requirements = Array.from({ length: 30 }, (_, index) => ({
    id: `MASTER-${String(index).padStart(4, '0')}`,
    status: 'verified',
    acceptance: {
      productionEntryPoints: ['src/runtime.mjs'],
      testPaths: [testPath],
      assertionBindings: [{
        testPath,
        positiveTestNames: ['allows bounded read action'],
        negativeTestNames: ['rejects missing scope'],
      }],
    },
  }));
  const report = auditMasterLedgerAssertions({
    requirements,
    existingPaths: new Set(['src/runtime.mjs', testPath]),
    sha256ByPath: new Map([['src/runtime.mjs', 'a'.repeat(64)]]),
    testIndex: index(),
    maxRequirementsPerTest: 25,
  });
  assert.equal(report.summary.assertionVerified, 30);
  assert.equal(report.summary.assertionUnbound, 0);
  assert.equal(report.records[0].explicitAssertionBindings.status, 'verified');
});
