import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateMasterRequirementEvidence, migrateMasterLedgerEvidence } from '../src/forensics/evidence-path-migrations.mjs';

function requirement(title, testPaths, productionEntryPoints = ['src/a.mjs']) {
  return { id: `R-${title}`, title, acceptance: { testPaths, negativeTestPaths: [], productionEntryPoints, evidenceHashes: {} }, metadata: {} };
}

test('evidence path migration partitions historical patch tests and preserves aliases as warnings', () => {
  const read = migrateMasterRequirementEvidence(requirement('Đọc đầu file', ['tests/patch-engine.test.mjs']));
  const transaction = migrateMasterRequirementEvidence(requirement('Tự rollback khi patch lỗi', ['tests/patch-engine.test.mjs']));
  const safety = migrateMasterRequirementEvidence(requirement('Chặn path traversal', ['tests/patch-engine.test.mjs']));
  assert.deepEqual(read.acceptance.testPaths, ['tests/patch-engine-read-search.test.mjs']);
  assert.deepEqual(transaction.acceptance.testPaths, ['tests/patch-engine-transaction.test.mjs']);
  assert.deepEqual(safety.acceptance.testPaths, ['tests/patch-engine-safety-write.test.mjs']);
  assert.equal(read.acceptance.historicalEvidenceAliases[0].from, 'tests/patch-engine.test.mjs');
  assert.equal(read.acceptance.historicalEvidenceAliases[0].kind, 'test');
});

test('evidence path migration removes source modules incorrectly recorded as tests and maps compatibility paths', () => {
  const value = migrateMasterRequirementEvidence(requirement('Test impact', [
    'src/construction/test-impact-selector.mjs',
    'tests/test-impact-selector.test.mjs',
    'tests/storage.test.mjs',
  ], ['vendor/forge-os/src/context/work-unit-contexts.mjs']));
  assert.deepEqual(value.acceptance.testPaths.sort(), ['tests/studio-store-compatibility.test.mjs', 'tests/test-impact-selector.test.mjs']);
  assert.deepEqual(value.acceptance.productionEntryPoints, ['vendor/forge-os/src/context/work-unit-context.mjs']);
  assert.equal(value.acceptance.historicalEvidenceAliases.length, 3);
});

test('ledger migration is deterministic and does not mutate the input ledger', () => {
  const input = { requirements: [requirement('Planner', ['tests/planner.test.mjs'])] };
  const output = migrateMasterLedgerEvidence(input);
  assert.equal(input.requirements[0].acceptance.testPaths[0], 'tests/planner.test.mjs');
  assert.deepEqual(output.requirements[0].acceptance.testPaths, ['tests/mission-planner-compatibility.test.mjs']);
  assert.deepEqual(migrateMasterLedgerEvidence(input), output);
});
