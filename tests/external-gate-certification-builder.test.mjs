import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS, verifyExternalGateCertificationFreshness } from '../src/release/external-gate-certification.mjs';
import { buildExternalGateCertificationSet } from '../scripts/build-external-gate-certification.mjs';

const SOURCE_SHA = 'b'.repeat(40);
const TESTED_SHA = 'c'.repeat(40);
const SOURCE_TREE_SHA = 'd'.repeat(40);
const RUN_ID = '31830000000';

function nativeGate(id, capability) {
  return { id, text: id, classification: 'native_runtime', observation: 'observed', capability };
}

function makeReceipt(platform) {
  const label = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
  const tree = { schema: 'forge.tree-sitter-runtime-capabilities.v1', available: true, command: 'tree-sitter', version: '0.25.10', versionMatches: true, externalRuntime: true, reason: null };
  const podman = platform === 'linux' ? { schema: 'forge.podman-capabilities.v1', available: true, version: '5.8.4', externalRuntime: true, rootlessRequired: true, networkDefault: 'deny' } : { available: false };
  const windows = platform === 'win32' ? { schema: 'forge.windows-job-object-capabilities.v1', available: true, platform: 'win32', nativeHelperRequired: true, version: '5.0.0-beta.6', lifecycle: true, childTerminated: true, cleanup: true } : { available: false };
  const mac = platform === 'darwin' ? { schema: 'forge.macos-sandbox-capabilities.v1', available: true, platform: 'darwin', executable: '/usr/bin/sandbox-exec', externalOsRuntime: true } : { available: false };
  const gates = [nativeGate('13.27', tree)];
  if (platform === 'linux') gates.push(nativeGate('21.4', podman));
  if (platform === 'win32') gates.push(nativeGate('21.6', windows));
  if (platform === 'darwin') gates.push(nativeGate('21.7', mac));
  const base = {
    schema: 'nolane.agent.external-gate-evidence.v1', version: '5.0.0-beta.6', totalExternalGates: 56,
    classSummary: { runner_os: 2, github_lifecycle: 8, managed_cloud: 35, native_runtime: 8, os_keychain: 1, provider_credentials: 2 },
    environment: {
      platform, arch: platform === 'darwin' ? 'arm64' : 'x64', node: 'v24.19.0', githubActions: true,
      githubEventName: 'pull_request', githubRepository: 'Nolane-x/Nolane-agent', githubRef: 'refs/pull/7/merge',
      githubSha: TESTED_SHA, githubHeadSha: SOURCE_SHA, githubRunId: RUN_ID, githubWorkflow: 'External gate evidence',
      githubWorkflowRef: 'Nolane-x/Nolane-agent/.github/workflows/external-gates.yml@refs/pull/7/merge', githubIssueLinked: false, runnerOs: label,
    },
    probes: { treeSitter: tree, podman, windowsJobObjects: windows, macOsSandbox: mac, docker: { available: false }, wsl: { available: false }, osKeychain: { available: false } },
    gates,
  };
  return { ...base, receiptSha256: canonicalSha256(base) };
}

async function prepareRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-cert-builder-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const paths of Object.values(BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS)) {
    for (const relativePath of paths) {
      const absolute = path.join(root, relativePath);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, `evidence:${relativePath}`);
    }
  }
  return root;
}

test('builder derives a freshness-bound four-gate certification candidate from one successful three-OS Actions run', async (t) => {
  const root = await prepareRoot(t);
  const receipts = { linux: makeReceipt('linux'), windows: makeReceipt('win32'), macos: makeReceipt('darwin') };
  const artifacts = [
    { id: 201, name: 'external-gates-linux', digest: `sha256:${'1'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
    { id: 202, name: 'external-gates-windows', digest: `sha256:${'2'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
    { id: 203, name: 'external-gates-macos', digest: `sha256:${'3'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
  ];
  const set = await buildExternalGateCertificationSet({ rootDirectory: root, receipts, artifacts, workflowConclusion: 'success', gitTreeResolver: async () => ({ sourceTreeSha: SOURCE_TREE_SHA, testedTreeSha: SOURCE_TREE_SHA }) });
  assert.deepEqual(set.requestedLegacyGateIds, ['13.27', '21.4', '21.6', '21.7']);
  assert.equal(set.sourceCommitSha, SOURCE_SHA);
  assert.equal(set.workflow.testedSha, TESTED_SHA);
  assert.equal(set.workflow.sourceTreeSha, SOURCE_TREE_SHA);
  assert.equal(set.workflow.testedTreeSha, SOURCE_TREE_SHA);
  assert.equal(set.workflow.runId, RUN_ID);
  assert.equal(set.artifacts.length, 3);
  assert.ok(set.gateEvidence['21.6'].files.some((entry) => entry.path === 'src/sandbox/windows-job-object-driver.mjs'));
  const verified = await verifyExternalGateCertificationFreshness(set, { rootDirectory: root, expectedSourceSha: SOURCE_SHA });
  assert.equal(verified.status, 'pass');
});

test('builder refuses to combine receipts from different workflow runs', async (t) => {
  const root = await prepareRoot(t);
  const receipts = { linux: makeReceipt('linux'), windows: makeReceipt('win32'), macos: makeReceipt('darwin') };
  receipts.windows.environment.githubRunId = '999';
  const { receiptSha256: _old, ...without } = receipts.windows;
  receipts.windows.receiptSha256 = canonicalSha256(without);
  const artifacts = [
    { id: 201, name: 'external-gates-linux', digest: `sha256:${'1'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
    { id: 202, name: 'external-gates-windows', digest: `sha256:${'2'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
    { id: 203, name: 'external-gates-macos', digest: `sha256:${'3'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
  ];
  await assert.rejects(() => buildExternalGateCertificationSet({ rootDirectory: root, receipts, artifacts, workflowConclusion: 'success', gitTreeResolver: async () => ({ sourceTreeSha: SOURCE_TREE_SHA, testedTreeSha: SOURCE_TREE_SHA }) }), /workflow run|run mismatch/i);
});


test('builder fails closed when the tested pull-request merge tree differs from the immutable PR head tree', async (t) => {
  const root = await prepareRoot(t);
  const receipts = { linux: makeReceipt('linux'), windows: makeReceipt('win32'), macos: makeReceipt('darwin') };
  const artifacts = [
    { id: 301, name: 'external-gates-linux', digest: `sha256:${'4'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
    { id: 302, name: 'external-gates-windows', digest: `sha256:${'5'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
    { id: 303, name: 'external-gates-macos', digest: `sha256:${'6'.repeat(64)}`, workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA } },
  ];
  await assert.rejects(
    () => buildExternalGateCertificationSet({
      rootDirectory: root, receipts, artifacts, workflowConclusion: 'success',
      gitTreeResolver: async () => ({ sourceTreeSha: SOURCE_TREE_SHA, testedTreeSha: 'e'.repeat(40) }),
    }),
    /tree.*mismatch|tested.*tree|source.*tree/i,
  );
});
