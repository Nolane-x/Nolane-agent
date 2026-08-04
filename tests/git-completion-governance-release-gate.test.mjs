import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyGitCompletionGovernance } from '../src/release/git-completion-governance-verifier.mjs';

const VERIFIED_ITEMS = Object.freeze(['26.4', '26.11', '26.15', '26.16', '26.17', '26.18', '26.19', '26.25', '26.26', '26.33', '26.34', '27.6', '27.7', '27.8', '27.10']);

test('Git completion governance verifier proves commit, conflict-resolution, collision, API, UI, audit and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-git-governance-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyGitCompletionGovernance({ rootDirectory: path.resolve('.'), version: '2.10.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.verifiedItems, VERIFIED_ITEMS);
  assert.equal(report.limitations.remoteMutationClaimed, false);
  assert.equal(report.limitations.automaticSemanticResolutionClaimed, false);
  assert.equal(report.limitations.cleanMergeCorrectnessClaimed, false);
  assert.equal(report.limitations.rawGitHttpClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
