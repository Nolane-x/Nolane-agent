import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_EXACT_HEAD_WORKFLOWS,
  evaluateReleaseCandidate,
  selectExactHeadWorkflowEvidence
} from '../src/release/release-candidate-gate.mjs';

const SHA = 'a'.repeat(40);

function successfulRuns(sha = SHA) {
  return REQUIRED_EXACT_HEAD_WORKFLOWS.map((name, index) => ({
    id: index + 1,
    name,
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
    event: 'pull_request',
    html_url: `https://example.invalid/runs/${index + 1}`,
    run_started_at: '2026-08-16T00:00:00Z',
    updated_at: '2026-08-16T00:10:00Z'
  }));
}

test('release candidate requires one successful exact-head run for every required workflow', () => {
  const selected = selectExactHeadWorkflowEvidence({
    expectedSha: SHA,
    workflowRuns: successfulRuns()
  });
  assert.equal(selected.pass, true);
  assert.equal(selected.evidence.length, REQUIRED_EXACT_HEAD_WORKFLOWS.length);
  assert.deepEqual(selected.missing, []);
  assert.deepEqual(selected.failed, []);
});

test('release candidate rejects stale, missing, skipped, action-required, and failed workflow evidence', () => {
  const runs = successfulRuns();
  runs[0] = { ...runs[0], head_sha: 'b'.repeat(40) };
  runs[1] = { ...runs[1], conclusion: 'action_required' };
  runs[2] = { ...runs[2], conclusion: 'skipped' };
  runs[3] = { ...runs[3], conclusion: 'failure' };

  const selected = selectExactHeadWorkflowEvidence({ expectedSha: SHA, workflowRuns: runs });
  assert.equal(selected.pass, false);
  assert.ok(selected.missing.includes(REQUIRED_EXACT_HEAD_WORKFLOWS[0]));
  assert.ok(selected.failed.some((entry) => entry.name === REQUIRED_EXACT_HEAD_WORKFLOWS[1] && entry.conclusion === 'action_required'));
  assert.ok(selected.failed.some((entry) => entry.name === REQUIRED_EXACT_HEAD_WORKFLOWS[2] && entry.conclusion === 'skipped'));
  assert.ok(selected.failed.some((entry) => entry.name === REQUIRED_EXACT_HEAD_WORKFLOWS[3] && entry.conclusion === 'failure'));
});

test('release candidate fails closed when tag identity, product-perfection status, or external certification is not current', () => {
  const pass = evaluateReleaseCandidate({
    expectedSha: SHA,
    tagSha: SHA,
    workflowRuns: successfulRuns(),
    productPerfectionCounts: {
      PASS: 310,
      FAIL: 0,
      UNKNOWN: 0,
      BLOCKED: 0,
      NOT_APPLICABLE: 0,
      DEFERRED_WITH_REASON: 0
    },
    externalCertification: {
      status: 'pass',
      headSha: SHA,
      runnerReceipts: ['linux', 'windows', 'macos']
    }
  });
  assert.equal(pass.pass, true);
  assert.deepEqual(pass.blockers, []);

  for (const mutation of [
    { tagSha: 'b'.repeat(40) },
    { productPerfectionCounts: { PASS: 309, FAIL: 0, UNKNOWN: 1, BLOCKED: 0, NOT_APPLICABLE: 0, DEFERRED_WITH_REASON: 0 } },
    { externalCertification: { status: 'pass', headSha: 'b'.repeat(40), runnerReceipts: ['linux', 'windows', 'macos'] } },
    { externalCertification: { status: 'pass', headSha: SHA, runnerReceipts: ['linux', 'windows'] } }
  ]) {
    const report = evaluateReleaseCandidate({
      expectedSha: SHA,
      tagSha: SHA,
      workflowRuns: successfulRuns(),
      productPerfectionCounts: {
        PASS: 310,
        FAIL: 0,
        UNKNOWN: 0,
        BLOCKED: 0,
        NOT_APPLICABLE: 0,
        DEFERRED_WITH_REASON: 0
      },
      externalCertification: {
        status: 'pass',
        headSha: SHA,
        runnerReceipts: ['linux', 'windows', 'macos']
      },
      ...mutation
    });
    assert.equal(report.pass, false);
    assert.ok(report.blockers.length > 0);
  }
});
