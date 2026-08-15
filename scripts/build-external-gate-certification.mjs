import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { evidenceFileSha256 } from '../src/release/evidence-file-hash.mjs';
import {
  BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS,
  BOUNDED_EXTERNAL_RUNTIME_GATE_IDS,
  verifyExternalGateCertificationFreshness,
} from '../src/release/external-gate-certification.mjs';

const REPOSITORY = 'Nolane-x/Nolane-agent';
const WORKFLOW_NAME = 'External gate evidence';
const WORKFLOW_PATH = '.github/workflows/external-gates.yml';
const execFileAsync = promisify(execFile);

const PLATFORM_ARTIFACTS = Object.freeze({
  linux: 'external-gates-linux',
  windows: 'external-gates-windows',
  macos: 'external-gates-macos',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    assert(current.startsWith('--'), `unexpected argument: ${current}`);
    const key = current.slice(2);
    const value = argv[index + 1];
    assert(value && !value.startsWith('--'), `missing value for --${key}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function commonReceiptProvenance(receipts) {
  const entries = Object.entries(receipts ?? {});
  assert(entries.length === 3, 'certification builder requires exactly three runner receipts');
  for (const label of Object.keys(PLATFORM_ARTIFACTS)) assert(receipts[label], `missing ${label} runner receipt`);

  const first = receipts.linux;
  const environment = first?.environment ?? {};
  const testedCommitSha = String(environment.githubSha ?? '');
  const sourceCommitSha = String(environment.githubHeadSha ?? '');
  const runId = String(environment.githubRunId ?? '');
  const version = String(first?.version ?? '');
  assert(/^[a-f0-9]{40}$/.test(sourceCommitSha), 'runner PR head commit SHA is invalid');
  assert(/^[a-f0-9]{40}$/.test(testedCommitSha), 'runner tested merge commit SHA is invalid');
  assert(/^\d+$/.test(runId), 'runner workflow run id is invalid');
  assert(version, 'runner receipt version is missing');

  for (const [label, receipt] of entries) {
    const current = receipt?.environment ?? {};
    assert(String(current.githubHeadSha ?? '') === sourceCommitSha, `${label} PR head commit mismatch`);
    assert(String(current.githubSha ?? '') === testedCommitSha, `${label} tested merge commit mismatch`);
    assert(String(current.githubRunId ?? '') === runId, `${label} workflow run mismatch`);
    assert(current.githubRepository === REPOSITORY, `${label} repository mismatch`);
    assert(current.githubWorkflow === WORKFLOW_NAME, `${label} workflow name mismatch`);
    assert(current.githubEventName === 'pull_request', `${label} receipt is not from a pull_request run`);
    assert(String(receipt?.version ?? '') === version, `${label} receipt version mismatch`);
  }

  return { sourceCommitSha, testedCommitSha, runId, version };
}

function collectArtifacts(artifacts, runId, receipts) {
  const available = Array.isArray(artifacts) ? artifacts : artifacts?.artifacts;
  assert(Array.isArray(available), 'GitHub artifact metadata must contain an artifacts array');
  return Object.entries(PLATFORM_ARTIFACTS).map(([platform, artifactName]) => {
    const artifact = available.find((entry) => entry?.name === artifactName);
    assert(artifact, `missing GitHub artifact metadata for ${artifactName}`);
    assert(Number.isInteger(artifact.id) && artifact.id > 0, `${artifactName} artifact id is invalid`);
    assert(/^sha256:[a-f0-9]{64}$/.test(String(artifact.digest ?? '')), `${artifactName} artifact digest is invalid`);
    assert(String(artifact.workflow_run?.id ?? '') === runId, `${artifactName} artifact workflow run mismatch`);
    assert(String(artifact.workflow_run?.head_sha ?? '') === String(receipts[platform]?.environment?.githubHeadSha ?? ''), `${artifactName} artifact PR head commit mismatch`);
    return {
      platform,
      artifactId: artifact.id,
      artifactDigest: artifact.digest,
      receipt: receipts[platform],
    };
  });
}

async function buildGateEvidence(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const gateEvidence = {};
  for (const id of BOUNDED_EXTERNAL_RUNTIME_GATE_IDS) {
    const files = [];
    for (const relativePath of BOUNDED_EXTERNAL_RUNTIME_GATE_EVIDENCE_PATHS[id]) {
      const absolute = path.resolve(root, relativePath);
      const relative = path.relative(root, absolute);
      assert(!relative.startsWith('..') && !path.isAbsolute(relative), `freshness path escapes root: ${relativePath}`);
      const bytes = await readFile(absolute).catch(() => { throw new Error(`freshness file missing: ${relativePath}`); });
      files.push({ path: relativePath, sha256: evidenceFileSha256(bytes) });
    }
    gateEvidence[id] = { files };
  }
  return gateEvidence;
}

async function defaultGitTreeResolver({ rootDirectory, sourceCommitSha, testedCommitSha }) {
  const resolveTree = async (sha) => {
    const { stdout } = await execFileAsync('git', ['rev-parse', `${sha}^{tree}`], { cwd: path.resolve(rootDirectory), windowsHide: true });
    const tree = String(stdout ?? '').trim();
    assert(/^[a-f0-9]{40}$/.test(tree), `invalid git tree for ${sha}`);
    return tree;
  };
  const [sourceTreeSha, testedTreeSha] = await Promise.all([resolveTree(sourceCommitSha), resolveTree(testedCommitSha)]);
  return { sourceTreeSha, testedTreeSha };
}

export async function buildExternalGateCertificationSet({
  rootDirectory = process.cwd(),
  receipts,
  artifacts,
  workflowConclusion = 'success',
  gitTreeResolver = defaultGitTreeResolver,
} = {}) {
  assert(workflowConclusion === 'success', 'certification builder requires a successful workflow conclusion');
  const { sourceCommitSha, testedCommitSha, runId, version } = commonReceiptProvenance(receipts);
  const artifactEntries = collectArtifacts(artifacts, runId, receipts);
  const gateEvidence = await buildGateEvidence(rootDirectory);
  const { sourceTreeSha, testedTreeSha } = await gitTreeResolver({ rootDirectory, sourceCommitSha, testedCommitSha });
  assert(/^[a-f0-9]{40}$/.test(String(sourceTreeSha ?? '')) && /^[a-f0-9]{40}$/.test(String(testedTreeSha ?? '')), 'git tree provenance is invalid');
  assert(sourceTreeSha === testedTreeSha, 'tested pull-request merge tree/source PR head tree mismatch');

  const base = {
    schema: 'nolane.agent.external-gate-certification-set.v1',
    version,
    sourceCommitSha,
    workflow: {
      repository: REPOSITORY,
      name: WORKFLOW_NAME,
      path: WORKFLOW_PATH,
      runId,
      event: 'pull_request',
      conclusion: workflowConclusion,
      headSha: sourceCommitSha,
      testedSha: testedCommitSha,
      sourceTreeSha,
      testedTreeSha,
    },
    artifacts: artifactEntries,
    requestedLegacyGateIds: [...BOUNDED_EXTERNAL_RUNTIME_GATE_IDS],
    gateEvidence,
    claimPolicy: {
      scope: 'bounded-external-runtime',
      producerMaySelfCertify: false,
      completeParityClaimAllowed: false,
    },
  };
  const set = { ...base, receiptSha256: canonicalSha256(base) };
  await verifyExternalGateCertificationFreshness(set, { rootDirectory, expectedSourceSha: sourceCommitSha });
  return set;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDirectory = path.resolve(args['input-dir'] ?? '');
  const artifactsJson = path.resolve(args['artifacts-json'] ?? '');
  const output = path.resolve(args.output ?? '');
  assert(args['input-dir'] && args['artifacts-json'] && args.output, 'usage: --input-dir <dir> --artifacts-json <file> --output <file>');

  const receipts = {
    linux: await readJson(path.join(inputDirectory, 'linux.json')),
    windows: await readJson(path.join(inputDirectory, 'windows.json')),
    macos: await readJson(path.join(inputDirectory, 'macos.json')),
  };
  const artifacts = await readJson(artifactsJson);
  const set = await buildExternalGateCertificationSet({
    rootDirectory: process.cwd(),
    receipts,
    artifacts,
    workflowConclusion: 'success',
  });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(set, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    status: 'pass',
    sourceCommitSha: set.sourceCommitSha,
    workflowRunId: set.workflow.runId,
    verifiedLegacyGateIds: set.requestedLegacyGateIds,
    receiptSha256: set.receiptSha256,
    output,
  })}\n`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error?.stack ?? String(error));
    process.exitCode = 1;
  });
}
