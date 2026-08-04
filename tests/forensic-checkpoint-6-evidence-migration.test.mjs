import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCheckpoint6EvidenceFamily,
  migrateCheckpoint6RequirementEvidence,
  migrateCheckpoint6LedgerEvidence,
} from '../src/forensics/checkpoint-6-evidence-migration.mjs';

function requirement({ id = 'MASTER-EXAMPLE', status = 'verified', productionEntryPoints, testPaths = ['tests/legacy-broad.test.mjs'], assertionBindings } = {}) {
  return {
    id,
    title: `Requirement ${id}`,
    status,
    acceptance: {
      productionEntryPoints,
      testPaths,
      ...(assertionBindings ? { assertionBindings } : {}),
      historicalEvidenceAliases: [],
    },
    metadata: {},
  };
}

const CASES = [
  ['local-frontier', ['src/frontier-completion/local-frontier-completion-plane.mjs'], 'tests/local-frontier-completion-contracts.test.mjs'],
  ['capability', ['src/security/capability-registry.mjs'], 'tests/capability-governance-contracts.test.mjs'],
  ['repository-discovery', ['src/repository/repository-discovery-service.mjs'], 'tests/repository-discovery-contracts.test.mjs'],
  ['cloud-recovery', ['src/cloud/cloud-queue.mjs'], 'tests/cloud-recovery-contracts.test.mjs'],
  ['frontier-governance', ['src/frontier/self-improvement-constitution.mjs'], 'tests/frontier-governance-contracts.test.mjs'],
  ['git-workspace', ['src/execution/task-workspace.mjs'], 'tests/git-workspace-governance-contracts.test.mjs'],
  ['context-repository', ['src/agent/context-builder.mjs'], 'tests/context-repository-intelligence-contracts.test.mjs'],
  ['nolane-session', ['src/nolane-native/session-store.mjs'], 'tests/nolane-native-session-contracts.test.mjs'],
  ['nolane-orchestration', ['src/nolane-native/orchestration-service.mjs'], 'tests/nolane-native-orchestration-contracts.test.mjs'],
  ['nolane-runtime', ['src/nolane-native/runtime-service.mjs'], 'tests/nolane-native-runtime-contracts.test.mjs'],
  ['specialist-governance', ['src/small-model/specialist-model-fabric.mjs'], 'tests/small-model-specialist-governance-contracts.test.mjs'],
  ['third-party-provenance', ['THIRD_PARTY_NOTICES.md'], 'tests/third-party-provenance-contracts.test.mjs'],
];

for (const [family, productionEntryPoints, expectedTestPath] of CASES) {
  test(`checkpoint 6 evidence migration binds ${family} requirements to exact contract assertions`, () => {
    const input = requirement({ productionEntryPoints });
    assert.equal(classifyCheckpoint6EvidenceFamily(input), family);
    const output = migrateCheckpoint6RequirementEvidence(input);
    assert.deepEqual(output.acceptance.testPaths, [expectedTestPath]);
    assert.equal(output.acceptance.assertionBindings[0].testPath, expectedTestPath);
    assert.equal(output.acceptance.assertionBindings[0].positiveTestNames.length, 1);
    assert.equal(output.acceptance.assertionBindings[0].negativeTestNames.length, 1);
    assert.equal(output.acceptance.historicalEvidenceAliases.find((item) => item.kind === 'test').from, 'tests/legacy-broad.test.mjs');
    assert.equal(output.metadata.checkpoint6EvidenceFamily, family);
    if (family === 'third-party-provenance') assert.deepEqual(output.acceptance.productionEntryPoints, ['src/release/third-party-provenance.mjs']);
    assert.equal(input.acceptance.assertionBindings, undefined);
  });
}

test('checkpoint 6 evidence migration leaves external, already bound, and unmatched requirements unchanged', () => {
  const binding = [{ schema: 'nolane.forensics.requirement-assertion-binding-input.v1', testPath: 'tests/existing.test.mjs', positiveTestNames: ['positive'], negativeTestNames: ['negative'] }];
  const external = requirement({ status: 'external_gate', productionEntryPoints: ['src/security/capability-registry.mjs'] });
  const alreadyBound = requirement({ productionEntryPoints: ['src/security/capability-registry.mjs'], assertionBindings: binding });
  const unmatched = requirement({ productionEntryPoints: ['src/unclassified/local-module.mjs'] });
  assert.deepEqual(migrateCheckpoint6RequirementEvidence(external), external);
  assert.deepEqual(migrateCheckpoint6RequirementEvidence(alreadyBound), alreadyBound);
  assert.deepEqual(migrateCheckpoint6RequirementEvidence(unmatched), unmatched);
});

test('checkpoint 6 ledger migration is deterministic, preserves ids, and reports exact migration count', () => {
  const requirements = CASES.map(([family, productionEntryPoints], index) => requirement({ id: `MASTER-${index}`, productionEntryPoints }));
  requirements.push(requirement({ id: 'MASTER-UNMATCHED', productionEntryPoints: ['src/unclassified/local-module.mjs'] }));
  const ledger = { requirements, metadata: {} };
  const first = migrateCheckpoint6LedgerEvidence(ledger);
  const second = migrateCheckpoint6LedgerEvidence(ledger);
  assert.deepEqual(first, second);
  assert.deepEqual(first.requirements.map((item) => item.id), ledger.requirements.map((item) => item.id));
  assert.equal(first.metadata.checkpoint6EvidenceMigration.migratedRequirements, 12);
  assert.equal(first.metadata.checkpoint6EvidenceMigration.unmatchedRequirements, 1);
  assert.equal(first.metadata.checkpoint6EvidenceMigration.inventedRequirementIds, 0);
});
