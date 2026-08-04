import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyMissionStateProgress } from '../src/release/mission-state-progress-verifier.mjs';

test('mission state release verifier proves durable projection, cost and progress gates, API, UI, and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-mission-state-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyMissionStateProgress({ rootDirectory: path.resolve('.'), version: '2.2.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'user-and-repository-identity','completion-criteria-and-hypotheses','test-run-pass-fail-ledger','usage-and-cost-accounting',
    'cost-limit-enforcement','sandbox-and-approval-state','subagent-state','actual-progress-detection','stalled-progress-detection',
    'authenticated-api','observable-control-center','full-release-matrix-gate',
  ]);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
