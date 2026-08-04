import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildExternalCertificationCheckpoint,
  assertStableReleaseAllowed,
  verifyExternalCertificationReceipt,
} from '../src/native-core/external-certification-checkpoint.mjs';

const read = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('waves 16-19 checkpoint is fail-closed and preserves every external contract and Nolane gap', async () => {
  const conformance = await read('requirements/nolane-native-core-conformance.json');
  const requirements = await read('requirements/nolane-agent-v5-requirements.json');
  const checkpoint = buildExternalCertificationCheckpoint({ conformance, requirements, platform: 'linux', machine: { ramGb: 8, label: 'sandbox' } });
  assert.equal(checkpoint.localCore.wavesCompletedThrough, 15);
  assert.equal(checkpoint.localCore.verifiedContracts, 100);
  assert.equal(checkpoint.external.externalContracts, 15);
  assert.equal(checkpoint.external.unmappedPaths, 0);
  assert.deepEqual(checkpoint.external.openNolaneRequirements.map((entry) => entry.id).sort(), ['NOL-AUDIT-012', 'NOL-UI-002', 'NOL-UI-030', 'NOL-UI-031', 'NOL-UI-032']);
  assert.equal(checkpoint.waves.wave16.status, 'blocked_external');
  assert.equal(checkpoint.waves.wave17.status, 'blocked_external');
  assert.equal(checkpoint.waves.wave18.status, 'blocked_external');
  assert.equal(checkpoint.waves.wave19.status, 'blocked_external');
  assert.equal(checkpoint.claims.completeParityClaimAllowed, false);
  assert.equal(checkpoint.claims.superiorityClaimAllowed, false);
  assert.throws(() => assertStableReleaseAllowed(checkpoint), (error) => error.code === 'STABLE_RELEASE_BLOCKED');
});

test('external receipt verifier rejects secrets, mocks, missing negative paths and unverifiable effects', () => {
  const base = { schema: 'nolane.external-certification-receipt.v1', lane: 'provider-openai', environment: { os: 'win32', adapterVersion: '1.0.0' }, credentialReferenceId: 'vault:openai', sequence: ['request', 'cancel', 'retry'], effectSha256: 'a'.repeat(64), teardown: { status: 'pass' }, reconnect: { status: 'pass' }, negativePath: { status: 'pass' }, usage: { requests: 1, costUsd: 0.01 }, independentVerifier: { id: 'reviewer-1', status: 'pass' }, mock: false };
  assert.equal(verifyExternalCertificationReceipt(base).valid, true);
  assert.equal(verifyExternalCertificationReceipt({ ...base, credentialReferenceId: 'sk-secret' }).valid, false);
  assert.equal(verifyExternalCertificationReceipt({ ...base, mock: true }).valid, false);
  assert.equal(verifyExternalCertificationReceipt({ ...base, negativePath: null }).valid, false);
});

test('checkpoint enumerates all dogfood and adversarial replay scenarios without claiming they ran', async () => {
  const checkpoint = buildExternalCertificationCheckpoint({ conformance: await read('requirements/nolane-native-core-conformance.json'), requirements: await read('requirements/nolane-agent-v5-requirements.json'), platform: 'linux' });
  assert.equal(checkpoint.waves.wave18.dogfoodScenarios.length, 10);
  assert.ok(checkpoint.waves.wave18.adversarialScenarios.includes('prompt-injection'));
  assert.ok(checkpoint.waves.wave18.adversarialScenarios.includes('corrupted-session-store'));
  assert.equal(checkpoint.waves.wave18.executedScenarios, 0);
});
