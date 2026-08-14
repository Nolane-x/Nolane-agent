import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { evidenceFileSha256 } from '../src/release/evidence-file-hash.mjs';
import { verifyExternalGateCertificationSet } from '../src/release/external-gate-certification.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const RUN_ID = '31820000000';
const WORKFLOW = 'External gate evidence';
const WORKFLOW_REF = 'Nolane-x/Nolane-agent/.github/workflows/external-gates.yml@refs/pull/7/merge';

function gate(id, capability) {
  return Object.freeze({ id, text: id, classification: 'native_runtime', observation: 'observed', capability });
}

function receipt(platform) {
  const runnerOs = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
  const capabilities = {
    treeSitter: { schema: 'forge.tree-sitter-runtime-capabilities.v1', available: true, command: 'tree-sitter', version: '0.25.10', versionMatches: true, externalRuntime: true, reason: null },
    podman: platform === 'linux'
      ? { schema: 'forge.podman-capabilities.v1', available: true, version: '5.8.4', externalRuntime: true, rootlessRequired: true, networkDefault: 'deny' }
      : { schema: 'forge.podman-capabilities.v1', available: false, reason: 'not-installed' },
    windowsJobObjects: platform === 'win32'
      ? { schema: 'forge.windows-job-object-capabilities.v1', available: true, platform: 'win32', nativeHelperRequired: true, version: '5.0.0-beta.6', lifecycle: true, childTerminated: true, cleanup: true }
      : { available: false, lifecycle: false, reason: 'wrong-platform' },
    macOsSandbox: platform === 'darwin'
      ? { schema: 'forge.macos-sandbox-capabilities.v1', available: true, platform: 'darwin', executable: '/usr/bin/sandbox-exec', externalOsRuntime: true }
      : { schema: 'forge.macos-sandbox-capabilities.v1', available: false, platform, externalOsRuntime: true, reason: 'wrong-platform' },
  };
  const gates = [gate('13.27', capabilities.treeSitter)];
  if (platform === 'linux') gates.push(gate('21.4', capabilities.podman));
  if (platform === 'win32') gates.push(gate('21.6', capabilities.windowsJobObjects));
  if (platform === 'darwin') gates.push(gate('21.7', capabilities.macOsSandbox));
  const base = {
    schema: 'nolane.agent.external-gate-evidence.v1',
    version: '5.0.0-beta.6',
    totalExternalGates: 56,
    classSummary: { runner_os: 2, github_lifecycle: 8, managed_cloud: 35, native_runtime: 8, os_keychain: 1, provider_credentials: 2 },
    environment: {
      platform, arch: platform === 'darwin' ? 'arm64' : 'x64', node: 'v24.19.0', githubActions: true,
      githubEventName: 'pull_request', githubRepository: 'Nolane-x/Nolane-agent', githubRef: 'refs/pull/7/merge',
      githubSha: SOURCE_SHA, githubRunId: RUN_ID, githubWorkflow: WORKFLOW, githubWorkflowRef: WORKFLOW_REF,
      githubIssueLinked: false, runnerOs,
    },
    probes: capabilities,
    gates,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function certification(overrides = {}) {
  const artifacts = [
    { platform: 'linux', artifactId: 101, artifactDigest: `sha256:${'1'.repeat(64)}`, receipt: receipt('linux') },
    { platform: 'windows', artifactId: 102, artifactDigest: `sha256:${'2'.repeat(64)}`, receipt: receipt('win32') },
    { platform: 'macos', artifactId: 103, artifactDigest: `sha256:${'3'.repeat(64)}`, receipt: receipt('darwin') },
  ];
  const base = {
    schema: 'nolane.agent.external-gate-certification-set.v1',
    version: '5.0.0-beta.6',
    sourceCommitSha: SOURCE_SHA,
    workflow: {
      repository: 'Nolane-x/Nolane-agent', name: WORKFLOW, path: '.github/workflows/external-gates.yml',
      runId: RUN_ID, event: 'pull_request', conclusion: 'success', headSha: SOURCE_SHA,
    },
    artifacts,
    requestedLegacyGateIds: ['13.27', '21.4', '21.6', '21.7'],
    claimPolicy: { scope: 'bounded-external-runtime', producerMaySelfCertify: false, completeParityClaimAllowed: false },
    ...overrides,
  };
  return { ...base, receiptSha256: canonicalSha256(base) };
}

test('certification verifier promotes only the four explicitly bounded native runtime gates', () => {
  const result = verifyExternalGateCertificationSet(certification(), { expectedSourceSha: SOURCE_SHA });
  assert.equal(result.schema, 'nolane.agent.external-gate-certification-verification.v1');
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.verifiedLegacyGateIds, ['13.27', '21.4', '21.6', '21.7']);
  assert.equal(result.sourceCommitSha, SOURCE_SHA);
  assert.equal(result.workflowRunId, RUN_ID);
});

test('certification verifier fails closed when source commit provenance differs', () => {
  assert.throws(() => verifyExternalGateCertificationSet(certification(), { expectedSourceSha: 'b'.repeat(40) }), /source commit/i);
});

test('certification verifier rejects an embedded runner receipt after tampering', () => {
  const set = certification();
  set.artifacts[0].receipt.environment.githubSha = 'c'.repeat(40);
  assert.throws(() => verifyExternalGateCertificationSet(set, { expectedSourceSha: SOURCE_SHA }), /runner receipt hash|receipt hash/i);
});

test('certification verifier requires all three operating-system receipts', () => {
  const set = certification({ artifacts: certification().artifacts.filter((entry) => entry.platform !== 'macos') });
  const { receiptSha256: _old, ...base } = set;
  base.receiptSha256 = canonicalSha256(base);
  assert.throws(() => verifyExternalGateCertificationSet(base, { expectedSourceSha: SOURCE_SHA }), /macos|three operating/i);
});

test('certification verifier refuses promotion of a gate outside the bounded allowlist', () => {
  const set = certification({ requestedLegacyGateIds: ['13.27', '21.4', '21.6', '21.7', '21.5'] });
  const { receiptSha256: _old, ...base } = set;
  base.receiptSha256 = canonicalSha256(base);
  assert.throws(() => verifyExternalGateCertificationSet(base, { expectedSourceSha: SOURCE_SHA }), /not eligible|allowlist|21\.5/i);
});

test('certification freshness fails when a certified production or runtime-test file changes', async (t) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { verifyExternalGateCertificationFreshness, BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS } = await import('../src/release/external-gate-certification.mjs');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-external-cert-freshness-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const set = certification();
  set.gateEvidence = {};
  for (const id of set.requestedLegacyGateIds) {
    const files = [];
    for (const relativePath of BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS[id]) {
      const absolute = path.join(root, relativePath);
      await mkdir(path.dirname(absolute), { recursive: true });
      const content = `${id}:${relativePath}:v1`;
      await writeFile(absolute, content);
      files.push({ path: relativePath, sha256: evidenceFileSha256(content) });
    }
    set.gateEvidence[id] = { files };
  }
  const { receiptSha256: _old, ...base } = set;
  base.receiptSha256 = canonicalSha256(base);

  const pass = await verifyExternalGateCertificationFreshness(base, { rootDirectory: root, expectedSourceSha: SOURCE_SHA });
  assert.deepEqual(pass.verifiedLegacyGateIds, ['13.27', '21.4', '21.6', '21.7']);

  const changedPath = BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS['21.4'][0];
  await writeFile(path.join(root, changedPath), 'changed-after-certification');
  await assert.rejects(
    () => verifyExternalGateCertificationFreshness(base, { rootDirectory: root, expectedSourceSha: SOURCE_SHA }),
    /stale|hash mismatch|21\.4/i,
  );
});
