import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyLocalResourceSandbox } from '../src/release/local-resource-sandbox-verifier.mjs';

test('local resource sandbox verifier proves limits, durable scope, terminal attachment, API, UI, audit, matrix, and non-claims', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-local-resource-sandbox-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyLocalResourceSandbox({ rootDirectory: path.resolve('.'), version: '2.5.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'cross-platform-watchdog-process-tree', 'linux-cgroup-v2-hard-limits', 'bounded-workspace-disk-meter',
    'durable-principal-project-leases', 'sustained-violation-termination', 'terminal-fail-closed-attachment',
    'authenticated-read-sample-close-api', 'observable-sandbox-manager', 'item-level-feature-audit', 'full-release-matrix-gate',
  ]);
  assert.equal(report.limitations.windowsJobObjectsClaimed, false);
  assert.equal(report.limitations.macOsSandboxClaimed, false);
  assert.equal(report.limitations.podmanClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
