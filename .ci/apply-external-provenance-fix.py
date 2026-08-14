from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all(path, old, new, expected):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new))


replace_once(
    'src/release/external-gate-evidence.mjs',
    "    githubSha: bounded(process.env.GITHUB_SHA, 64),\n    githubRunId:",
    "    githubSha: bounded(process.env.GITHUB_SHA, 64),\n    githubHeadSha: bounded(process.env.NOLANE_GITHUB_HEAD_SHA || process.env.GITHUB_SHA, 64),\n    githubRunId:",
)

replace_once(
    'src/release/external-gate-certification.mjs',
    "function verifyRunnerReceipt(receipt, { sourceCommitSha, runId, platformLabel }) {",
    "function verifyRunnerReceipt(receipt, { sourceCommitSha, testedCommitSha, runId, platformLabel }) {",
)
replace_once(
    'src/release/external-gate-certification.mjs',
    "  assert(environment.githubSha === sourceCommitSha, `${platformLabel} runner source commit mismatch`);",
    "  assert(environment.githubHeadSha === sourceCommitSha, `${platformLabel} runner PR head commit mismatch`);\n  assert(environment.githubSha === testedCommitSha, `${platformLabel} runner tested merge commit mismatch`);",
)
replace_once(
    'src/release/external-gate-certification.mjs',
    "  assert(workflow.headSha === set.sourceCommitSha, 'certification workflow head/source commit mismatch');",
    "  assert(workflow.headSha === set.sourceCommitSha, 'certification workflow head/source commit mismatch');\n  assert(/^[a-f0-9]{40}$/.test(String(workflow.testedSha ?? '')), 'certification tested merge commit SHA is invalid');\n  assert(/^[a-f0-9]{40}$/.test(String(workflow.sourceTreeSha ?? '')) && /^[a-f0-9]{40}$/.test(String(workflow.testedTreeSha ?? '')), 'certification tree provenance is invalid');\n  assert(workflow.sourceTreeSha === workflow.testedTreeSha, 'certification tested tree/source tree mismatch');",
)
replace_once(
    'src/release/external-gate-certification.mjs',
    "    receipts[label] = verifyRunnerReceipt(artifact.receipt, { sourceCommitSha: set.sourceCommitSha, runId: workflow.runId, platformLabel: label });",
    "    receipts[label] = verifyRunnerReceipt(artifact.receipt, { sourceCommitSha: set.sourceCommitSha, testedCommitSha: workflow.testedSha, runId: workflow.runId, platformLabel: label });",
)
replace_once(
    'src/release/external-gate-certification.mjs',
    "    workflowRunId: String(workflow.runId),\n    verifiedLegacyGateIds:",
    "    workflowRunId: String(workflow.runId),\n    testedCommitSha: workflow.testedSha,\n    sourceTreeSha: workflow.sourceTreeSha,\n    verifiedLegacyGateIds:",
)

replace_once(
    'scripts/build-external-gate-certification.mjs',
    "import { fileURLToPath } from 'node:url';",
    "import { fileURLToPath } from 'node:url';\nimport { promisify } from 'node:util';\nimport { execFile } from 'node:child_process';",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "const PLATFORM_ARTIFACTS",
    "const execFileAsync = promisify(execFile);\n\nconst PLATFORM_ARTIFACTS",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "  const sourceCommitSha = String(environment.githubSha ?? '');\n  const runId = String(environment.githubRunId ?? '');",
    "  const testedCommitSha = String(environment.githubSha ?? '');\n  const sourceCommitSha = String(environment.githubHeadSha ?? '');\n  const runId = String(environment.githubRunId ?? '');",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "  assert(/^[a-f0-9]{40}$/.test(sourceCommitSha), 'runner source commit SHA is invalid');",
    "  assert(/^[a-f0-9]{40}$/.test(sourceCommitSha), 'runner PR head commit SHA is invalid');\n  assert(/^[a-f0-9]{40}$/.test(testedCommitSha), 'runner tested merge commit SHA is invalid');",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "    assert(String(current.githubSha ?? '') === sourceCommitSha, `${label} source commit mismatch`);",
    "    assert(String(current.githubHeadSha ?? '') === sourceCommitSha, `${label} PR head commit mismatch`);\n    assert(String(current.githubSha ?? '') === testedCommitSha, `${label} tested merge commit mismatch`);",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "  return { sourceCommitSha, runId, version };",
    "  return { sourceCommitSha, testedCommitSha, runId, version };",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "    assert(String(artifact.workflow_run?.id ?? '') === runId, `${artifactName} artifact workflow run mismatch`);",
    "    assert(String(artifact.workflow_run?.id ?? '') === runId, `${artifactName} artifact workflow run mismatch`);\n    assert(String(artifact.workflow_run?.head_sha ?? '') === String(receipts[platform]?.environment?.githubHeadSha ?? ''), `${artifactName} artifact PR head commit mismatch`);",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "export async function buildExternalGateCertificationSet({\n",
    "async function defaultGitTreeResolver({ rootDirectory, sourceCommitSha, testedCommitSha }) {\n  const resolveTree = async (sha) => {\n    const { stdout } = await execFileAsync('git', ['rev-parse', `${sha}^{tree}`], { cwd: path.resolve(rootDirectory), windowsHide: true });\n    const tree = String(stdout ?? '').trim();\n    assert(/^[a-f0-9]{40}$/.test(tree), `invalid git tree for ${sha}`);\n    return tree;\n  };\n  const [sourceTreeSha, testedTreeSha] = await Promise.all([resolveTree(sourceCommitSha), resolveTree(testedCommitSha)]);\n  return { sourceTreeSha, testedTreeSha };\n}\n\nexport async function buildExternalGateCertificationSet({\n",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "  workflowConclusion = 'success',\n} = {}) {",
    "  workflowConclusion = 'success',\n  gitTreeResolver = defaultGitTreeResolver,\n} = {}) {",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "  const { sourceCommitSha, runId, version } = commonReceiptProvenance(receipts);\n  const artifactEntries",
    "  const { sourceCommitSha, testedCommitSha, runId, version } = commonReceiptProvenance(receipts);\n  const artifactEntries",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "  const gateEvidence = await buildGateEvidence(rootDirectory);",
    "  const gateEvidence = await buildGateEvidence(rootDirectory);\n  const { sourceTreeSha, testedTreeSha } = await gitTreeResolver({ rootDirectory, sourceCommitSha, testedCommitSha });\n  assert(/^[a-f0-9]{40}$/.test(String(sourceTreeSha ?? '')) && /^[a-f0-9]{40}$/.test(String(testedTreeSha ?? '')), 'git tree provenance is invalid');\n  assert(sourceTreeSha === testedTreeSha, 'tested pull-request merge tree/source PR head tree mismatch');",
)
replace_once(
    'scripts/build-external-gate-certification.mjs',
    "      headSha: sourceCommitSha,\n    },",
    "      headSha: sourceCommitSha,\n      testedSha: testedCommitSha,\n      sourceTreeSha,\n      testedTreeSha,\n    },",
)

replace_once(
    '.github/workflows/external-gates.yml',
    "permissions:\n  contents: read\n  actions: read\n",
    "permissions:\n  contents: read\n  actions: read\n\nenv:\n  NOLANE_GITHUB_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}\n",
)

replace_once(
    'tests/external-gate-evidence.test.mjs',
    "'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_RUN_ID'",
    "'GITHUB_REF', 'GITHUB_SHA', 'NOLANE_GITHUB_HEAD_SHA', 'GITHUB_RUN_ID'",
)
replace_once(
    'tests/external-gate-evidence.test.mjs',
    "    GITHUB_SHA: 'a'.repeat(40),\n    GITHUB_RUN_ID:",
    "    GITHUB_SHA: 'a'.repeat(40),\n    NOLANE_GITHUB_HEAD_SHA: 'b'.repeat(40),\n    GITHUB_RUN_ID:",
)
replace_once(
    'tests/external-gate-evidence.test.mjs',
    "  assert.equal(report.environment.githubSha, 'a'.repeat(40));\n  assert.equal(report.environment.githubRunId",
    "  assert.equal(report.environment.githubSha, 'a'.repeat(40));\n  assert.equal(report.environment.githubHeadSha, 'b'.repeat(40));\n  assert.equal(report.environment.githubRunId",
)

replace_once(
    'tests/external-gate-certification.test.mjs',
    "const SOURCE_SHA = 'a'.repeat(40);\nconst RUN_ID",
    "const SOURCE_SHA = 'a'.repeat(40);\nconst TESTED_SHA = 'b'.repeat(40);\nconst TREE_SHA = 'c'.repeat(40);\nconst RUN_ID",
)
replace_all(
    'tests/external-gate-certification.test.mjs',
    "githubSha: SOURCE_SHA, githubRunId: RUN_ID",
    "githubSha: TESTED_SHA, githubHeadSha: SOURCE_SHA, githubRunId: RUN_ID",
    1,
)
replace_once(
    'tests/external-gate-certification.test.mjs',
    "runId: RUN_ID, event: 'pull_request', conclusion: 'success', headSha: SOURCE_SHA,",
    "runId: RUN_ID, event: 'pull_request', conclusion: 'success', headSha: SOURCE_SHA, testedSha: TESTED_SHA, sourceTreeSha: TREE_SHA, testedTreeSha: TREE_SHA,",
)
replace_once(
    'tests/external-gate-certification.test.mjs',
    "  assert.equal(result.sourceCommitSha, SOURCE_SHA);\n  assert.equal(result.workflowRunId, RUN_ID);",
    "  assert.equal(result.sourceCommitSha, SOURCE_SHA);\n  assert.equal(result.testedCommitSha, TESTED_SHA);\n  assert.equal(result.sourceTreeSha, TREE_SHA);\n  assert.equal(result.workflowRunId, RUN_ID);",
)
p = Path('tests/external-gate-certification.test.mjs')
text = p.read_text()
block = """

test('certification verifier rejects a candidate when tested merge tree and PR head tree differ', () => {
  const set = certification();
  set.workflow.testedTreeSha = 'd'.repeat(40);
  const { receiptSha256: _old, ...base } = set;
  base.receiptSha256 = canonicalSha256(base);
  assert.throws(() => verifyExternalGateCertificationSet(base, { expectedSourceSha: SOURCE_SHA }), /tree.*mismatch|tested.*tree|source.*tree/i);
});
"""
if block.strip() in text:
    raise SystemExit('certification tree-mismatch test already exists')
p.write_text(text + block)

replace_once(
    'tests/external-gate-certification-builder.test.mjs',
    "const SOURCE_SHA = 'b'.repeat(40);\nconst RUN_ID",
    "const SOURCE_SHA = 'b'.repeat(40);\nconst TESTED_SHA = 'c'.repeat(40);\nconst SOURCE_TREE_SHA = 'd'.repeat(40);\nconst RUN_ID",
)
replace_all(
    'tests/external-gate-certification-builder.test.mjs',
    "githubSha: SOURCE_SHA, githubRunId: RUN_ID",
    "githubSha: TESTED_SHA, githubHeadSha: SOURCE_SHA, githubRunId: RUN_ID",
    1,
)
replace_all(
    'tests/external-gate-certification-builder.test.mjs',
    "workflow_run: { id: Number(RUN_ID) }",
    "workflow_run: { id: Number(RUN_ID), head_sha: SOURCE_SHA }",
    6,
)
replace_once(
    'tests/external-gate-certification-builder.test.mjs',
    "const set = await buildExternalGateCertificationSet({ rootDirectory: root, receipts, artifacts, workflowConclusion: 'success' });",
    "const set = await buildExternalGateCertificationSet({ rootDirectory: root, receipts, artifacts, workflowConclusion: 'success', gitTreeResolver: async () => ({ sourceTreeSha: SOURCE_TREE_SHA, testedTreeSha: SOURCE_TREE_SHA }) });",
)
replace_once(
    'tests/external-gate-certification-builder.test.mjs',
    "  assert.equal(set.sourceCommitSha, SOURCE_SHA);\n  assert.equal(set.workflow.runId, RUN_ID);",
    "  assert.equal(set.sourceCommitSha, SOURCE_SHA);\n  assert.equal(set.workflow.testedSha, TESTED_SHA);\n  assert.equal(set.workflow.sourceTreeSha, SOURCE_TREE_SHA);\n  assert.equal(set.workflow.testedTreeSha, SOURCE_TREE_SHA);\n  assert.equal(set.workflow.runId, RUN_ID);",
)
replace_once(
    'tests/external-gate-certification-builder.test.mjs',
    "() => buildExternalGateCertificationSet({ rootDirectory: root, receipts, artifacts, workflowConclusion: 'success' }),",
    "() => buildExternalGateCertificationSet({ rootDirectory: root, receipts, artifacts, workflowConclusion: 'success', gitTreeResolver: async () => ({ sourceTreeSha: SOURCE_TREE_SHA, testedTreeSha: SOURCE_TREE_SHA }) }),",
)
p = Path('tests/external-gate-certification-builder.test.mjs')
text = p.read_text()
block = """

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
"""
if block.strip() in text:
    raise SystemExit('builder tree-mismatch test already exists')
p.write_text(text + block)

replace_once(
    'tests/external-gate-certification-workflow.test.mjs',
    "  assert.match(workflow, /certification-candidate:/);",
    "  assert.match(workflow, /NOLANE_GITHUB_HEAD_SHA:/);\n  assert.match(workflow, /github\\.event\\.pull_request\\.head\\.sha/);\n  assert.match(workflow, /certification-candidate:/);",
)
