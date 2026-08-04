import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EntitlementPolicy } from '../src/native-core/entitlement-policy.mjs';

const REQUIRED_CONTRACTS = [
  'NATIVE-SHELL-HOOK-POLICY',
  'NATIVE-LAZY-DEPENDENCY-RESOLUTION',
  'NATIVE-DAEMON-POOL-LIFECYCLE',
  'NATIVE-TOOL-DISPATCH-PIPELINE',
  'NATIVE-SESSION-STREAM-COORDINATION',
  'NATIVE-CONVERSATION-CORRECTION',
  'NATIVE-GATEWAY-REMOTE-LIFECYCLE',
  'NATIVE-ACP-PROXY-TRANSPORT',
  'NATIVE-VOICE-COMPOSER-STATE',
  'NATIVE-REAUTHENTICATION-FLOW',
  'NATIVE-TUI-STATE-STORES',
  'NATIVE-UPDATE-LIFECYCLE',
  'NATIVE-ENTITLEMENT-POLICY',
];

test('wave 6 removes residual catch-all contracts and preserves complete single-owner coverage', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const ids = new Set(catalog.contracts.map((contract) => contract.id));

  assert.deepEqual(catalog.contracts.filter((contract) => contract.id.includes('RESIDUAL')), []);
  assert.deepEqual(catalog.contracts.flatMap((contract) => contract.upstreamPathPatterns ?? []).filter((pattern) => pattern === '^.*$'), []);
  for (const id of REQUIRED_CONTRACTS) assert.ok(ids.has(id), `missing ${id}`);

  assert.equal(conformance.candidateMappings.length, 2110);
  assert.equal(new Set(conformance.candidateMappings.map((entry) => entry.sourcePath)).size, 2110);
  assert.equal(conformance.unmatchedCandidateIds.length, 0);
  assert.equal(conformance.candidateStatusCounts.not_implemented, 0);
  assert.ok(conformance.evidence.every((entry) => entry.candidateFiles > 0), 'empty contracts must be pruned');
});

test('wave 6 records an explicit Nolane-owned entitlement decision instead of inheriting NolaneNative billing', async () => {
  const decision = JSON.parse(await readFile('requirements/nolane-entitlement-policy.json', 'utf8'));
  assert.equal(decision.schema, 'nolane.entitlement-policy.v1');
  assert.equal(decision.owner, 'Nolane Agent');
  assert.equal(decision.upstreamBillingCopied, false);
  assert.equal(decision.defaultTier, 'community');
  assert.deepEqual(decision.secretFields, []);
  assert.ok(decision.capabilities.community.length > 0);
});


test('Nolane entitlement policy is local, deterministic and fail-closed for unknown capabilities', () => {
  const policy = new EntitlementPolicy({ tier: 'community' });
  assert.equal(policy.allows('agent:local'), true);
  assert.equal(policy.allows('provider:hosted'), false);
  assert.equal(policy.allows('unknown:capability'), false);
  assert.throws(() => new EntitlementPolicy({ tier: 'unknown' }), /unknown entitlement tier/i);
  assert.deepEqual(policy.snapshot().secretFields, []);
});

import { defaultReleaseGates } from '../src/release/full-release-matrix.mjs';

test('wave 6 release matrix exposes all four decomposition gates', () => {
  const ids = new Set(defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.7' }).map((gate) => gate.id));
  for (const id of [
    'native-core-no-residual-catchall',
    'native-core-single-owner-mapping',
    'native-core-zero-empty-contract',
    'native-core-exclusion-policy',
  ]) assert.ok(ids.has(id), `missing release gate ${id}`);
});
