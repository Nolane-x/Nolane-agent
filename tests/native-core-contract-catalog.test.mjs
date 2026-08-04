import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  verifyCoreContracts,
  buildNativeCoreCatalog,
  validateCoreCatalog,
} from '../src/native-core/core-conformance-verifier.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-core-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'src', 'agent.mjs'), 'export class Agent {}\n');
  await writeFile(path.join(root, 'src', 'app.mjs'), "import { Agent } from './agent.mjs';\nexport const agent = new Agent();\n");
  await writeFile(path.join(root, 'tests', 'agent.test.mjs'), "import assert from 'node:assert/strict';\nassert.throws(() => { throw new Error('bounded'); });\n");
  return root;
}

const inventoryFixture = {
  schemaVersion: 'nolane.nolane_native.core.inventory.v1',
  contracts: [
    { id: 'UPSTREAM-AGENT', domain: 'agent-kernel', behaviorSourcePath: 'agent/conversation_loop.py', sourceSha256: 'a'.repeat(64), status: 'inventory_only' },
    { id: 'UPSTREAM-DISCORD', domain: 'gateway-integrations', behaviorSourcePath: 'gateway/platforms/discord.py', sourceSha256: 'b'.repeat(64), status: 'inventory_only' },
  ],
};

test('core catalog rejects file-only evidence and duplicate contract IDs', () => {
  assert.throws(() => validateCoreCatalog({ schema: 'nolane.native-core.contract-catalog.v1', contracts: [
    { id: 'NATIVE-X', domain: 'agent-kernel', title: 'X', status: 'verified', entrypoints: ['src/x.mjs'], tests: [], negativeTests: [], productionWiring: [] },
  ] }), /direct test/i);
  assert.throws(() => validateCoreCatalog({ schema: 'nolane.native-core.contract-catalog.v1', contracts: [
    { id: 'NATIVE-X', domain: 'agent-kernel', title: 'X', status: 'not_implemented' },
    { id: 'NATIVE-X', domain: 'agent-kernel', title: 'X2', status: 'not_implemented' },
  ] }), /duplicate/i);
});

test('core conformance verifier binds upstream candidates to production entrypoints, tests and wiring', async (t) => {
  const rootDirectory = await fixture(t);
  const catalog = buildNativeCoreCatalog({ contracts: [{
    id: 'NATIVE-AGENT-TURN',
    domain: 'agent-kernel',
    title: 'Bounded agent turns',
    status: 'verified',
    upstreamPathPatterns: ['^agent/(conversation_loop|turn_.*)\\.py$'],
    entrypoints: ['src/agent.mjs'],
    tests: ['tests/agent.test.mjs'],
    negativeTests: ['tests/agent.test.mjs'],
    productionWiring: [{ path: 'src/app.mjs', contains: 'new Agent' }],
    externalCondition: null,
  }] });
  const receipt = await verifyCoreContracts({ rootDirectory, catalog, nolane_nativeInventory: inventoryFixture });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.summary.verifiedContracts, 1);
  assert.equal(receipt.candidateStatusCounts.verified, 1);
  assert.equal(receipt.candidateStatusCounts.not_implemented, 1);
  assert.deepEqual(receipt.unmatchedCandidateIds, ['UPSTREAM-DISCORD']);
  assert.equal(receipt.evidence[0].title, 'Bounded agent turns');
  assert.equal(receipt.evidence[0].domain, 'agent-kernel');
  assert.equal(receipt.evidence[0].candidateFiles, 1);
  assert.deepEqual(receipt.evidence[0].upstreamBehaviorSources, [{
    candidateId: 'UPSTREAM-AGENT',
    path: 'agent/conversation_loop.py',
    sha256: 'a'.repeat(64),
  }]);
  assert.equal(receipt.candidateMappings[0].sourceSha256, 'a'.repeat(64));
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('conformance receipt aggregates many upstream files under one behavior contract without losing path hashes', async (t) => {
  const rootDirectory = await fixture(t);
  const inventory = structuredClone(inventoryFixture);
  inventory.contracts.splice(1, 0, {
    id: 'UPSTREAM-TURN-STATE',
    domain: 'agent-kernel',
    behaviorSourcePath: 'agent/turn_state.py',
    sourceSha256: 'c'.repeat(64),
    status: 'inventory_only',
  });
  const catalog = buildNativeCoreCatalog({ contracts: [{
    id: 'NATIVE-AGENT-TURN',
    domain: 'agent-kernel',
    title: 'Bounded agent turns',
    status: 'verified',
    upstreamPathPatterns: ['^agent/(conversation_loop|turn_.*)\\.py$'],
    entrypoints: ['src/agent.mjs'],
    tests: ['tests/agent.test.mjs'],
    negativeTests: ['tests/agent.test.mjs'],
    productionWiring: [{ path: 'src/app.mjs', contains: 'new Agent' }],
    externalCondition: null,
  }] });
  const receipt = await verifyCoreContracts({ rootDirectory, catalog, nolane_nativeInventory: inventory });
  const behavior = receipt.evidence.find((entry) => entry.id === 'NATIVE-AGENT-TURN');
  assert.equal(behavior.candidateFiles, 2);
  assert.deepEqual(behavior.upstreamBehaviorSources.map((entry) => entry.path), [
    'agent/conversation_loop.py',
    'agent/turn_state.py',
  ]);
  assert.deepEqual(behavior.upstreamBehaviorSources.map((entry) => entry.sha256), [
    'a'.repeat(64),
    'c'.repeat(64),
  ]);
});

test('core conformance verifier rejects stale wiring and missing negative evidence', async (t) => {
  const rootDirectory = await fixture(t);
  const catalog = buildNativeCoreCatalog({ contracts: [{
    id: 'NATIVE-AGENT-TURN', domain: 'agent-kernel', title: 'Bounded agent turns', status: 'verified',
    upstreamPathPatterns: ['^agent/conversation_loop\\.py$'], entrypoints: ['src/agent.mjs'], tests: ['tests/agent.test.mjs'], negativeTests: ['tests/missing.test.mjs'],
    productionWiring: [{ path: 'src/app.mjs', contains: 'missing token' }], externalCondition: null,
  }] });
  await assert.rejects(() => verifyCoreContracts({ rootDirectory, catalog, nolane_nativeInventory: inventoryFixture }), /negative test|wiring token/i);
});

test('repository native core catalog maps every runtime candidate and keeps unresolved certification external', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const inventory = JSON.parse(await readFile('requirements/nolane-native-core-inventory.json', 'utf8'));
  const receipt = await verifyCoreContracts({ rootDirectory: process.cwd(), catalog, nolane_nativeInventory: inventory });
  assert.equal(receipt.status, 'pass');
  assert.equal(new Set(catalog.contracts.map((entry) => entry.domain)).size, 19);
  assert.equal(receipt.summary.verifiedContracts, 100);
  assert.equal(receipt.summary.externalContracts, 15);
  assert.equal(receipt.candidateStatusCounts.not_implemented, 0);
  assert.equal(receipt.unmatchedCandidateIds.length, 0);
  assert.equal(receipt.summary.completeParityClaimAllowed, false);
});


test('catalog priority permits reviewed broad external coverage without hiding specific native evidence', async (t) => {
  const rootDirectory = await fixture(t);
  const catalog = buildNativeCoreCatalog({ contracts: [
    {
      id: 'NATIVE-SPECIFIC', domain: 'agent-kernel', title: 'Specific native turn', status: 'verified', priority: 100,
      upstreamPathPatterns: ['^agent/conversation_loop\.py$'], entrypoints: ['src/agent.mjs'], tests: ['tests/agent.test.mjs'], negativeTests: ['tests/agent.test.mjs'],
      productionWiring: [{ path: 'src/app.mjs', contains: 'new Agent' }], externalCondition: null,
    },
    {
      id: 'NATIVE-BROAD-EXTERNAL', domain: 'agent-kernel', title: 'Reviewed residual agent behavior', status: 'external_gate', priority: 0,
      upstreamPathPatterns: ['^agent/.*\.py$'], entrypoints: ['src/agent.mjs'], tests: ['tests/agent.test.mjs'], negativeTests: ['tests/agent.test.mjs'],
      productionWiring: [{ path: 'src/app.mjs', contains: 'new Agent' }], externalCondition: 'Run residual behavior against a provider-real fixture.',
    },
  ] });
  const receipt = await verifyCoreContracts({ rootDirectory, catalog, nolane_nativeInventory: inventoryFixture });
  assert.equal(receipt.candidateMappings.find((entry) => entry.candidateId === 'UPSTREAM-AGENT').contractId, 'NATIVE-SPECIFIC');
  assert.equal(receipt.summary.completeParityClaimAllowed, false);
});

test('catalog rejects ambiguous matches at the same priority', async (t) => {
  const rootDirectory = await fixture(t);
  const shared = {
    domain: 'agent-kernel', status: 'verified', priority: 5, upstreamPathPatterns: ['^agent/.*\.py$'],
    entrypoints: ['src/agent.mjs'], tests: ['tests/agent.test.mjs'], negativeTests: ['tests/agent.test.mjs'],
    productionWiring: [{ path: 'src/app.mjs', contains: 'new Agent' }], externalCondition: null,
  };
  const catalog = buildNativeCoreCatalog({ contracts: [
    { ...shared, id: 'NATIVE-A', title: 'A' }, { ...shared, id: 'NATIVE-B', title: 'B' },
  ] });
  await assert.rejects(() => verifyCoreContracts({ rootDirectory, catalog, nolane_nativeInventory: inventoryFixture }), /ambiguous native core mapping/i);
});
