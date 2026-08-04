import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  generateMasterLedger,
  validateMasterLedger,
  normalizeRequirementTitle,
} from '../src/requirements/master-ledger.mjs';

const legacyFixture = {
  productVersion: '4.0.0',
  totalItems: 3,
  sections: [{
    number: 1,
    title: 'Core',
    items: [
      { id: '1.1', text: 'Chặn path traversal', status: 'verified_source_test', evidence: ['src/security/path-policy.mjs', 'tests/path-policy.test.mjs'] },
      { id: '1.2', text: 'Chặn path traversal', status: 'verified_source_test', evidence: ['src/execution/tool-broker.mjs', 'tests/tool-broker.test.mjs'] },
      { id: '1.3', text: 'Windows runtime certification', status: 'external_gate', evidence: ['src/runtime/runtime-profile-service.mjs'] },
    ],
  }],
};

const nolaneFixture = {
  version: '5.0.0-beta.1',
  total: 2,
  requirements: [
    {
      id: 'NOL-001',
      group: 'Runtime',
      title: 'Canonical runtime identity',
      status: 'verified_source_test',
      acceptance: { entrypoint: 'src/product-identity.mjs', exactTest: 'tests/nolane-product-identity.test.mjs', evidence: { entrypointSha256: 'a'.repeat(64), exactTestSha256: 'b'.repeat(64) } },
    },
    { id: 'NOL-002', group: 'External', title: 'Windows runtime certification', status: 'not_implemented', acceptance: {} },
  ],
};

const nolane_nativeFixture = {
  schemaVersion: 'nolane.nolane_native.core.inventory.v1',
  sourceSnapshot: { label: 'fixture', treeSha256: 'c'.repeat(64), fileCount: 1, bytes: 10 },
  contracts: [{ id: 'NOLANE_NATIVE_AGENT_X', domain: 'agent-kernel', behaviorSourcePath: 'agent/loop.py', sourceSha256: 'd'.repeat(64), status: 'inventory_only' }],
  entries: [], domains: [], unmappedCorePaths: [], excludedPaths: [],
  summary: { entries: 1, coreEntries: 1, excludedEntries: 0, unmappedCorePaths: 0, contractCandidates: 1 },
  receiptSha256: 'e'.repeat(64),
};

function nativeConformanceFixture({ status = 'verified', candidateCount = 1 } = {}) {
  const sources = Array.from({ length: candidateCount }, (_, index) => ({
    candidateId: index === 0 ? 'NOLANE_NATIVE_AGENT_X' : `NOLANE_NATIVE_AGENT_${index}`,
    path: index === 0 ? 'agent/loop.py' : `agent/turn_${index}.py`,
    sha256: String(index + 4).repeat(64).slice(0, 64),
  }));
  return {
    schema: 'nolane.native-core.conformance-receipt.v1',
    receiptSha256: 'f'.repeat(64),
    summary: { contracts: 1, candidateContracts: candidateCount },
    candidateMappings: sources.map((entry) => ({
      candidateId: entry.candidateId,
      sourcePath: entry.path,
      sourceSha256: entry.sha256,
      domain: 'agent-kernel',
      contractId: 'NATIVE-AGENT',
      status,
    })),
    evidence: [{
      id: 'NATIVE-AGENT', title: 'Bounded agent lifecycle', domain: 'agent-kernel', status,
      externalCondition: status === 'external_gate' ? 'Run against a provider-real model.' : null,
      candidateFiles: candidateCount,
      upstreamBehaviorSources: sources,
      entrypoints: [{ path: 'src/nolane-native/agent-loop.mjs', sha256: '1'.repeat(64) }],
      tests: [{ path: 'tests/nolane-native-agent-loop.test.mjs', sha256: '2'.repeat(64) }],
      negativeTests: [{ path: 'tests/nolane-native-agent-loop.test.mjs', sha256: '2'.repeat(64) }],
      productionWiring: [{ path: 'src/app.mjs', contains: 'NolaneAgentLoop', sha256: '3'.repeat(64) }],
    }],
    unmatchedCandidateIds: [],
  };
}

test('normalizes requirement titles deterministically without erasing meaning', () => {
  assert.equal(normalizeRequirementTitle('  Chặn PATH-traversal!  '), 'chan path traversal');
  assert.notEqual(normalizeRequirementTitle('Windows runtime'), normalizeRequirementTitle('Linux runtime'));
});

test('master ledger deduplicates exact semantic aliases and retains every source ID', () => {
  const ledger = generateMasterLedger({ legacyAudit: legacyFixture, nolaneV5: nolaneFixture, nolane_nativeInventory: nolane_nativeFixture });
  assert.equal(ledger.summary.inputItems, 6);
  assert.equal(ledger.summary.canonicalItems, 4);
  const traversal = ledger.requirements.find((entry) => entry.normalizedTitle === 'chan path traversal');
  assert.deepEqual(traversal.aliases.map((entry) => entry.id), ['1.1', '1.2']);
  const windows = ledger.requirements.find((entry) => entry.normalizedTitle === 'windows runtime certification');
  assert.deepEqual(windows.aliases.map((entry) => entry.id), ['1.3', 'NOL-002']);
  assert.equal(windows.status, 'external_gate');
  assert.equal(validateMasterLedger(ledger).status, 'pass');
});



test('master ledger never fuzzy-deduplicates distinct upstream source contracts', () => {
  const inventory = structuredClone(nolane_nativeFixture);
  inventory.contracts.push({ id: 'NOLANE_NATIVE_AGENT_Y', domain: 'agent-kernel', behaviorSourcePath: 'agent/loop_py.py', sourceSha256: 'f'.repeat(64), status: 'inventory_only' });
  inventory.contracts[0].behaviorSourcePath = 'agent/loop/py.py';
  const ledger = generateMasterLedger({ legacyAudit: legacyFixture, nolaneV5: nolaneFixture, nolane_nativeInventory: inventory });
  assert.equal(ledger.requirements.filter((entry) => entry.aliases.some((alias) => alias.source === 'nolane_nativeCore')).length, 2);
});

test('master ledger preserves inventory-only contracts as open and never treats file existence as proof', () => {
  const ledger = generateMasterLedger({ legacyAudit: legacyFixture, nolaneV5: nolaneFixture, nolane_nativeInventory: nolane_nativeFixture });
  const contract = ledger.requirements.find((entry) => entry.aliases.some((alias) => alias.id === 'NOLANE_NATIVE_AGENT_X'));
  assert.equal(contract.status, 'not_implemented');
  assert.equal(contract.acceptance.fileExistenceIsProof, false);
  assert.equal(contract.acceptance.productionEntrypoint, null);
});

test('master ledger validation rejects verified records without source, test, production path and hashes', () => {
  const ledger = generateMasterLedger({ legacyAudit: legacyFixture, nolaneV5: nolaneFixture, nolane_nativeInventory: nolane_nativeFixture });
  const corrupted = structuredClone(ledger);
  const verified = corrupted.requirements.find((entry) => entry.status === 'verified');
  verified.acceptance.testPaths = [];
  assert.throws(() => validateMasterLedger(corrupted), /verified requirement lacks direct test evidence/i);
});



test('master ledger applies native conformance status and evidence to NolaneNative candidates without adding duplicate rows', () => {
  const conformance = nativeConformanceFixture();
  const ledger = generateMasterLedger({ legacyAudit: legacyFixture, nolaneV5: nolaneFixture, nolane_nativeInventory: nolane_nativeFixture, nativeConformance: conformance });
  const contract = ledger.requirements.find((entry) => entry.aliases.some((alias) => alias.id === 'NATIVE-AGENT'));
  assert.equal(contract.status, 'verified');
  assert.equal(contract.title, 'Bounded agent lifecycle');
  assert.deepEqual(contract.acceptance.productionEntryPoints, ['src/nolane-native/agent-loop.mjs']);
  assert.deepEqual(contract.acceptance.testPaths, ['tests/nolane-native-agent-loop.test.mjs']);
  assert.deepEqual(contract.acceptance.negativeTestPaths, ['tests/nolane-native-agent-loop.test.mjs']);
  assert.equal(ledger.summary.inputItems, 6);
  assert.equal(ledger.sources.nolane_nativeCore.inputItems, 1);
  assert.equal(ledger.sources.nolane_nativeCore.upstreamCandidateFiles, 1);
  assert.equal(ledger.sourceSnapshots.nativeConformanceReceiptSha256, 'f'.repeat(64));
});

test('master ledger counts one native behavior contract while preserving every upstream source path and hash', () => {
  const inventory = structuredClone(nolane_nativeFixture);
  inventory.contracts.push({
    id: 'NOLANE_NATIVE_AGENT_1', domain: 'agent-kernel', behaviorSourcePath: 'agent/turn_1.py',
    sourceSha256: '5'.repeat(64), status: 'inventory_only',
  });
  inventory.summary.contractCandidates = 2;
  const conformance = nativeConformanceFixture({ candidateCount: 2 });
  const ledger = generateMasterLedger({ legacyAudit: legacyFixture, nolaneV5: nolaneFixture, nolane_nativeInventory: inventory, nativeConformance: conformance });
  assert.equal(ledger.sources.nolane_nativeCore.inputItems, 1);
  assert.equal(ledger.sources.nolane_nativeCore.upstreamCandidateFiles, 2);
  const contract = ledger.requirements.find((entry) => entry.aliases.some((alias) => alias.id === 'NATIVE-AGENT'));
  assert.equal(contract.acceptance.upstreamBehaviorSources.length, 2);
  assert.deepEqual(contract.acceptance.upstreamBehaviorSources.map((entry) => entry.path), [
    'agent/loop.py',
    'agent/turn_1.py',
  ]);
});

test('repository master ledger reconciles legacy, Nolane V5 and full NolaneNative inventory without double counting', async () => {
  const ledger = JSON.parse(await readFile('requirements/master-acceptance-ledger.json', 'utf8'));
  const inventory = JSON.parse(await readFile('requirements/nolane-native-core-inventory.json', 'utf8'));
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  assert.equal(ledger.schema, 'nolane.master.acceptance-ledger.v1');
  assert.equal(ledger.sources.legacy.inputItems, 1150);
  assert.equal(ledger.sources.nolaneV5.inputItems, 198);
  assert.equal(ledger.sources.nolane_nativeCore.inputItems, conformance.summary.contracts);
  assert.equal(ledger.sources.nolane_nativeCore.upstreamCandidateFiles, inventory.summary.contractCandidates);
  assert.equal(ledger.summary.inputItems, 1150 + 198 + conformance.summary.contracts);
  assert.equal(ledger.summary.canonicalItems, ledger.summary.inputItems - 3);
  assert.equal(ledger.summary.deduplicatedAliases, 3);
  assert.equal(validateMasterLedger(ledger).status, 'pass');
});
