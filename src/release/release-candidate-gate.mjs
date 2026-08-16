const SHA_RE = /^[a-f0-9]{40}$/;

export const REQUIRED_EXACT_HEAD_WORKFLOWS = Object.freeze([
  'Nolane Agent CI',
  'UI runtime visual evidence',
  'UI runtime performance evidence',
  'Proofline empty runtime evidence',
  'Proofline ledger runtime evidence',
  'External gate evidence'
]);

const REQUIRED_EXTERNAL_PLATFORMS = Object.freeze(['linux', 'windows', 'macos']);
const BLOCKING_MATRIX_STATUSES = Object.freeze(['FAIL', 'UNKNOWN', 'BLOCKED']);

function normalizeSha(value) {
  return String(value ?? '').trim().toLowerCase();
}

function newestFirst(left, right) {
  const leftTime = Date.parse(left?.updated_at ?? left?.run_started_at ?? 0) || 0;
  const rightTime = Date.parse(right?.updated_at ?? right?.run_started_at ?? 0) || 0;
  if (rightTime !== leftTime) return rightTime - leftTime;
  return Number(right?.id ?? 0) - Number(left?.id ?? 0);
}

function summarizeRun(run) {
  return Object.freeze({
    id: run?.id ?? null,
    name: String(run?.name ?? ''),
    headSha: normalizeSha(run?.head_sha),
    status: String(run?.status ?? ''),
    conclusion: String(run?.conclusion ?? ''),
    event: String(run?.event ?? ''),
    url: String(run?.html_url ?? ''),
    runStartedAt: run?.run_started_at ?? null,
    updatedAt: run?.updated_at ?? null
  });
}

export function selectExactHeadWorkflowEvidence({
  expectedSha,
  workflowRuns,
  requiredWorkflows = REQUIRED_EXACT_HEAD_WORKFLOWS
} = {}) {
  const normalizedExpectedSha = normalizeSha(expectedSha);
  const runs = Array.isArray(workflowRuns) ? workflowRuns : [];
  const required = [...new Set(requiredWorkflows.map((value) => String(value).trim()).filter(Boolean))];
  const evidence = [];
  const missing = [];
  const failed = [];

  if (!SHA_RE.test(normalizedExpectedSha)) {
    return Object.freeze({
      schema: 'nolane.release.exact-head-workflow-evidence.v1',
      expectedSha: normalizedExpectedSha,
      pass: false,
      evidence: Object.freeze([]),
      missing: Object.freeze(required),
      failed: Object.freeze([{ name: 'exact-head', conclusion: 'invalid-sha' }])
    });
  }

  for (const name of required) {
    const exactHeadRuns = runs
      .filter((run) => String(run?.name ?? '') === name && normalizeSha(run?.head_sha) === normalizedExpectedSha)
      .sort(newestFirst);

    if (exactHeadRuns.length === 0) {
      missing.push(name);
      continue;
    }

    const successful = exactHeadRuns.find((run) => run?.status === 'completed' && run?.conclusion === 'success');
    if (successful) {
      evidence.push(summarizeRun(successful));
      continue;
    }

    const latest = exactHeadRuns[0];
    failed.push(Object.freeze({
      name,
      status: String(latest?.status ?? ''),
      conclusion: String(latest?.conclusion ?? ''),
      runId: latest?.id ?? null,
      url: String(latest?.html_url ?? '')
    }));
  }

  return Object.freeze({
    schema: 'nolane.release.exact-head-workflow-evidence.v1',
    expectedSha: normalizedExpectedSha,
    pass: missing.length === 0 && failed.length === 0 && evidence.length === required.length,
    evidence: Object.freeze(evidence),
    missing: Object.freeze(missing),
    failed: Object.freeze(failed)
  });
}

function evaluateProductPerfection(counts = {}) {
  const normalized = {};
  for (const key of ['PASS', 'FAIL', 'UNKNOWN', 'BLOCKED', 'NOT_APPLICABLE', 'DEFERRED_WITH_REASON']) {
    normalized[key] = Number.isFinite(Number(counts?.[key])) ? Number(counts[key]) : 0;
  }
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const blockers = BLOCKING_MATRIX_STATUSES
    .filter((status) => normalized[status] > 0)
    .map((status) => `product-perfection:${status.toLowerCase()}:${normalized[status]}`);
  if (total <= 0) blockers.push('product-perfection:empty');
  return { counts: Object.freeze(normalized), total, blockers };
}

function evaluateExternalCertification(certification, expectedSha) {
  const blockers = [];
  const sourceSha = normalizeSha(certification?.headSha ?? certification?.sourceCommitSha);
  const status = String(certification?.status ?? certification?.workflow?.conclusion ?? '').toLowerCase();
  const platforms = Array.isArray(certification?.runnerReceipts)
    ? certification.runnerReceipts.map((value) => String(value).toLowerCase())
    : Array.isArray(certification?.artifacts)
      ? certification.artifacts.map((entry) => String(entry?.platform ?? '').toLowerCase())
      : [];
  const uniquePlatforms = [...new Set(platforms.filter(Boolean))];

  if (status !== 'pass' && status !== 'success') blockers.push(`external-certification:status:${status || 'missing'}`);
  if (sourceSha !== expectedSha) blockers.push('external-certification:stale-head');
  for (const platform of REQUIRED_EXTERNAL_PLATFORMS) {
    if (!uniquePlatforms.includes(platform)) blockers.push(`external-certification:missing-platform:${platform}`);
  }

  return {
    status,
    sourceSha,
    platforms: Object.freeze(uniquePlatforms),
    blockers
  };
}

export function evaluateReleaseCandidate({
  expectedSha,
  tagSha,
  workflowRuns,
  productPerfectionCounts,
  externalCertification,
  requiredWorkflows = REQUIRED_EXACT_HEAD_WORKFLOWS
} = {}) {
  const normalizedExpectedSha = normalizeSha(expectedSha);
  const normalizedTagSha = normalizeSha(tagSha);
  const blockers = [];

  if (!SHA_RE.test(normalizedExpectedSha)) blockers.push('candidate:invalid-expected-sha');
  if (!SHA_RE.test(normalizedTagSha)) blockers.push('candidate:invalid-tag-sha');
  if (SHA_RE.test(normalizedExpectedSha) && normalizedTagSha !== normalizedExpectedSha) blockers.push('candidate:tag-sha-mismatch');

  const workflows = selectExactHeadWorkflowEvidence({
    expectedSha: normalizedExpectedSha,
    workflowRuns,
    requiredWorkflows
  });
  for (const name of workflows.missing) blockers.push(`workflow:missing:${name}`);
  for (const entry of workflows.failed) blockers.push(`workflow:not-green:${entry.name}:${entry.conclusion || entry.status || 'unknown'}`);

  const productPerfection = evaluateProductPerfection(productPerfectionCounts);
  blockers.push(...productPerfection.blockers);

  const external = evaluateExternalCertification(externalCertification, normalizedExpectedSha);
  blockers.push(...external.blockers);

  return Object.freeze({
    schema: 'nolane.release.candidate-gate.v1',
    expectedSha: normalizedExpectedSha,
    tagSha: normalizedTagSha,
    pass: blockers.length === 0,
    blockers: Object.freeze(blockers),
    workflowEvidence: workflows,
    productPerfection: Object.freeze({ counts: productPerfection.counts, total: productPerfection.total }),
    externalCertification: Object.freeze({ status: external.status, sourceSha: external.sourceSha, platforms: external.platforms })
  });
}
