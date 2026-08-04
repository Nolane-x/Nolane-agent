import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCheckpoint5RequirementEvidence, migrateCheckpoint5LedgerEvidence } from '../src/forensics/checkpoint-5-evidence-migration.mjs';

function requirement(title, testPaths) {
  return { id: 'MASTER-EXAMPLE', title, acceptance: { testPaths, productionEntryPoints: ['src/agent/agent-loop.mjs'], historicalEvidenceAliases: [] }, metadata: {} };
}

test('checkpoint 5 evidence migration binds exact positive and negative tests', () => {
  const value = migrateCheckpoint5RequirementEvidence(requirement('Kiểm tra giới hạn token', ['tests/agent-loop.test.mjs', 'tests/mission-runner.test.mjs']));
  assert.deepEqual(value.acceptance.testPaths, ['tests/agent-runtime-budget-recovery-contracts.test.mjs']);
  assert.equal(value.acceptance.assertionBindings[0].positiveTestNames[0], 'run budget records bounded turns tools tokens and elapsed time');
  assert.equal(value.acceptance.assertionBindings[0].negativeTestNames[0], 'run budget rejects cancellation and exhausted limits');
  assert.equal(value.acceptance.historicalEvidenceAliases.length, 2);
});

test('checkpoint 5 evidence migration preserves unrelated tests and never invents requirement ids', () => {
  const input = requirement('Trả stdout', ['tests/tool-broker.test.mjs', 'tests/other-specific.test.mjs']);
  const value = migrateCheckpoint5RequirementEvidence(input);
  assert.equal(value.id, input.id);
  assert.ok(value.acceptance.testPaths.includes('tests/other-specific.test.mjs'));
  assert.ok(value.acceptance.testPaths.includes('tests/execution-process-lifecycle-contracts.test.mjs'));
  assert.equal(input.acceptance.assertionBindings, undefined);
});

test('checkpoint 5 ledger migration is deterministic and migrates the high-volume families', () => {
  const ledger = {
    requirements: Array.from({ length: 205 }, (_, index) => ({
      id: `MASTER-${String(index).padStart(4, '0')}`,
      title: index % 2 ? 'Kiểm tra giới hạn token' : 'Trả stdout',
      acceptance: { testPaths: [index % 2 ? 'tests/agent-loop.test.mjs' : 'tests/tool-broker.test.mjs'], productionEntryPoints: ['src/runtime.mjs'] },
      metadata: {},
    })),
  };
  const first = migrateCheckpoint5LedgerEvidence(ledger);
  const second = migrateCheckpoint5LedgerEvidence(ledger);
  assert.deepEqual(first, second);
  assert.equal(first.requirements.length, ledger.requirements.length);
  assert.equal(first.metadata.checkpoint5EvidenceMigration.migratedRequirements, 205);
  assert.equal(first.metadata.checkpoint5EvidenceMigration.inventedRequirementIds, 0);
});
