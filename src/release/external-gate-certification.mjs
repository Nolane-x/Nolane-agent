import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { evidenceFileSha256 } from './evidence-file-hash.mjs';

const REPOSITORY = 'Nolane-x/Nolane-agent';
const WORKFLOW = 'External gate evidence';
const WORKFLOW_PATH = '.github/workflows/external-gates.yml';
const ELIGIBLE_GATE_IDS = Object.freeze(['13.27', '21.4', '21.6', '21.7']);
export const BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS = Object.freeze({
  '13.27': Object.freeze(['src/repository/tree-sitter-runtime-service.mjs', 'tests/tree-sitter-runtime-evidence.test.mjs']),
  '21.4': Object.freeze(['src/sandbox/podman-sandbox-driver.mjs', 'tests/podman-runtime-evidence.test.mjs']),
  '21.6': Object.freeze(['src/sandbox/windows-job-object-driver.mjs', 'src/release/external-gate-evidence.mjs', 'tests/external-gate-evidence.test.mjs']),
  '21.7': Object.freeze(['src/sandbox/macos-sandbox-driver.mjs', 'tests/macos-sandbox-runtime-evidence.test.mjs']),
});
const PLATFORM_CONTRACT = Object.freeze({
  linux: Object.freeze({ platform: 'linux', runnerOs: 'Linux' }),
  windows: Object.freeze({ platform: 'win32', runnerOs: 'Windows' }),
  macos: Object.freeze({ platform: 'darwin', runnerOs: 'macOS' }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalReceiptHash(value) {
  const { receiptSha256: _receipt, ...withoutReceipt } = value ?? {};
  return canonicalSha256(withoutReceipt);
}

function verifyRunnerReceipt(receipt, { sourceCommitSha, runId, platformLabel }) {
  assert(receipt?.schema === 'nolane.agent.external-gate-evidence.v1', `invalid ${platformLabel} runner receipt schema`);
  assert(/^[a-f0-9]{64}$/.test(String(receipt.receiptSha256 ?? '')), `${platformLabel} runner receipt hash is missing`);
  assert(receipt.receiptSha256 === canonicalReceiptHash(receipt), `${platformLabel} runner receipt hash mismatch`);
  const expected = PLATFORM_CONTRACT[platformLabel];
  assert(expected, `unsupported certification platform: ${platformLabel}`);
  const environment = receipt.environment ?? {};
  assert(environment.platform === expected.platform, `${platformLabel} runner platform mismatch`);
  assert(environment.runnerOs === expected.runnerOs, `${platformLabel} runner label mismatch`);
  assert(environment.githubActions === true, `${platformLabel} receipt was not produced by GitHub Actions`);
  assert(environment.githubRepository === REPOSITORY, `${platformLabel} receipt repository mismatch`);
  assert(environment.githubEventName === 'pull_request', `${platformLabel} receipt must come from a pull_request run`);
  assert(environment.githubSha === sourceCommitSha, `${platformLabel} runner source commit mismatch`);
  assert(String(environment.githubRunId ?? '') === String(runId), `${platformLabel} runner workflow run mismatch`);
  assert(environment.githubWorkflow === WORKFLOW, `${platformLabel} runner workflow name mismatch`);
  assert(String(environment.githubWorkflowRef ?? '').includes(`${REPOSITORY}/${WORKFLOW_PATH}@`), `${platformLabel} runner workflow ref mismatch`);
  return receipt;
}

function observedNativeGate(receipt, id) {
  const gate = (receipt.gates ?? []).find((entry) => entry?.id === id);
  assert(gate, `runner receipt lacks gate ${id}`);
  assert(gate.classification === 'native_runtime', `gate ${id} has unexpected classification`);
  assert(gate.observation === 'observed', `gate ${id} was not observed`);
  assert(gate.capability?.available === true, `gate ${id} capability is unavailable`);
  return gate.capability;
}

function verifyTreeSitter(receipts) {
  for (const [platform, receipt] of Object.entries(receipts)) {
    const capability = observedNativeGate(receipt, '13.27');
    assert(capability.schema === 'forge.tree-sitter-runtime-capabilities.v1', `${platform} Tree-sitter capability schema mismatch`);
    assert(capability.externalRuntime === true, `${platform} Tree-sitter evidence is not external runtime evidence`);
    assert(capability.version === '0.25.10' && capability.versionMatches === true, `${platform} Tree-sitter version is not pinned to 0.25.10`);
  }
}

function verifyPodman(receipts) {
  const capability = observedNativeGate(receipts.linux, '21.4');
  assert(capability.schema === 'forge.podman-capabilities.v1', 'Linux Podman capability schema mismatch');
  assert(capability.externalRuntime === true, 'Podman evidence is not external runtime evidence');
  assert(capability.rootlessRequired === true, 'Podman certification must require rootless execution');
  assert(capability.networkDefault === 'deny', 'Podman certification must default network access to deny');
  assert(Boolean(String(capability.version ?? '').trim()), 'Podman runtime version is missing');
}

function verifyWindowsJobObject(receipts) {
  const capability = observedNativeGate(receipts.windows, '21.6');
  assert(capability.schema === 'forge.windows-job-object-capabilities.v1', 'Windows Job Object capability schema mismatch');
  assert(capability.platform === 'win32' && capability.nativeHelperRequired === true, 'Windows Job Object native helper evidence is incomplete');
  assert(capability.lifecycle === true && capability.childTerminated === true && capability.cleanup === true, 'Windows Job Object lifecycle evidence is incomplete');
}

function verifyMacOsSandbox(receipts) {
  const capability = observedNativeGate(receipts.macos, '21.7');
  assert(capability.schema === 'forge.macos-sandbox-capabilities.v1', 'macOS sandbox capability schema mismatch');
  assert(capability.platform === 'darwin' && capability.externalOsRuntime === true, 'macOS sandbox external runtime evidence is incomplete');
  assert(capability.executable === '/usr/bin/sandbox-exec', 'macOS sandbox executable mismatch');
}

export function verifyExternalGateCertificationSet(set, { expectedSourceSha = null } = {}) {
  assert(set?.schema === 'nolane.agent.external-gate-certification-set.v1', 'invalid external gate certification set schema');
  assert(/^[a-f0-9]{64}$/.test(String(set.receiptSha256 ?? '')), 'external gate certification receipt hash is missing');
  assert(set.receiptSha256 === canonicalReceiptHash(set), 'external gate certification receipt hash mismatch');
  assert(/^[a-f0-9]{40}$/.test(String(set.sourceCommitSha ?? '')), 'invalid certification source commit SHA');
  if (expectedSourceSha) assert(set.sourceCommitSha === expectedSourceSha, 'certification source commit does not match expected source commit');

  const workflow = set.workflow ?? {};
  assert(workflow.repository === REPOSITORY, 'certification workflow repository mismatch');
  assert(workflow.name === WORKFLOW && workflow.path === WORKFLOW_PATH, 'certification workflow identity mismatch');
  assert(workflow.event === 'pull_request' && workflow.conclusion === 'success', 'certification workflow must be a successful pull_request run');
  assert(String(workflow.runId ?? '').match(/^\d+$/), 'certification workflow run id is invalid');
  assert(workflow.headSha === set.sourceCommitSha, 'certification workflow head/source commit mismatch');
  assert(set.claimPolicy?.scope === 'bounded-external-runtime', 'certification claim scope mismatch');
  assert(set.claimPolicy?.producerMaySelfCertify === false, 'certification producer self-certification must remain disabled');
  assert(set.claimPolicy?.completeParityClaimAllowed === false, 'bounded certification cannot enable complete parity');

  const requested = [...new Set(set.requestedLegacyGateIds ?? [])].sort();
  assert(requested.length > 0, 'certification must request at least one legacy gate');
  for (const id of requested) assert(ELIGIBLE_GATE_IDS.includes(id), `legacy gate ${id} is not eligible for bounded external runtime promotion`);

  const artifacts = Array.isArray(set.artifacts) ? set.artifacts : [];
  assert(artifacts.length === 3, 'certification requires exactly three operating-system receipts');
  const receipts = {};
  for (const artifact of artifacts) {
    const label = String(artifact?.platform ?? '');
    assert(PLATFORM_CONTRACT[label], `unsupported certification artifact platform: ${label}`);
    assert(!receipts[label], `duplicate certification artifact platform: ${label}`);
    assert(Number.isInteger(artifact.artifactId) && artifact.artifactId > 0, `${label} artifact id is invalid`);
    assert(/^sha256:[a-f0-9]{64}$/.test(String(artifact.artifactDigest ?? '')), `${label} artifact digest is invalid`);
    receipts[label] = verifyRunnerReceipt(artifact.receipt, { sourceCommitSha: set.sourceCommitSha, runId: workflow.runId, platformLabel: label });
  }
  for (const label of Object.keys(PLATFORM_CONTRACT)) assert(receipts[label], `certification is missing ${label} operating-system receipt`);

  const predicates = new Map([
    ['13.27', () => verifyTreeSitter(receipts)],
    ['21.4', () => verifyPodman(receipts)],
    ['21.6', () => verifyWindowsJobObject(receipts)],
    ['21.7', () => verifyMacOsSandbox(receipts)],
  ]);
  for (const id of requested) predicates.get(id)();

  return Object.freeze({
    schema: 'nolane.agent.external-gate-certification-verification.v1',
    status: 'pass',
    sourceCommitSha: set.sourceCommitSha,
    workflowRunId: String(workflow.runId),
    verifiedLegacyGateIds: Object.freeze(requested),
    receiptSha256: set.receiptSha256,
  });
}


export async function verifyExternalGateCertificationFreshness(set, { rootDirectory = process.cwd(), expectedSourceSha = null } = {}) {
  const verified = verifyExternalGateCertificationSet(set, { expectedSourceSha });
  const root = path.resolve(rootDirectory);
  for (const id of verified.verifiedLegacyGateIds) {
    const requiredPaths = BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS[id];
    assert(requiredPaths, `no freshness policy exists for certified gate ${id}`);
    const evidence = set.gateEvidence?.[id];
    assert(evidence && Array.isArray(evidence.files), `certification gate ${id} lacks freshness evidence`);
    const byPath = new Map(evidence.files.map((entry) => [entry?.path, entry]));
    assert(byPath.size === requiredPaths.length, `certification gate ${id} has an unexpected freshness evidence set`);
    for (const relativePath of requiredPaths) {
      const recorded = byPath.get(relativePath);
      assert(recorded && /^[a-f0-9]{64}$/.test(String(recorded.sha256 ?? '')), `certification gate ${id} lacks hash for ${relativePath}`);
      const absolute = path.resolve(root, relativePath);
      const relative = path.relative(root, absolute);
      assert(!relative.startsWith('..') && !path.isAbsolute(relative), `certification gate ${id} freshness path escapes root: ${relativePath}`);
      const bytes = await readFile(absolute).catch(() => { throw new Error(`certification gate ${id} freshness file missing: ${relativePath}`); });
      const current = evidenceFileSha256(bytes);
      assert(current === recorded.sha256, `certification gate ${id} stale evidence hash mismatch: ${relativePath}`);
    }
  }
  return verified;
}

export const BOUNDED_EXTERNAL_RUNTIME_GATE_IDS = ELIGIBLE_GATE_IDS;
