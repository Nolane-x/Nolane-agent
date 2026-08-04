import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyAgentModes } from '../src/release/agent-modes-verifier.mjs';

test('agent modes release verifier proves 20 canonical modes, runtime enforcement, API, UI, and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-agent-modes-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyAgentModes({ rootDirectory: path.resolve('.'), version: '2.0.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.equal(report.modeCount, 20);
  assert.deepEqual(report.requiredCapabilities, [
    'canonical-mode-registry','narrowing-only-resolution','mission-and-task-propagation','broker-boundary-enforcement',
    'offline-local-provider','receipt-mode-binding','authenticated-api','lazy-control-center','full-release-matrix-gate',
  ]);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  const persisted = JSON.parse(await readFile(outputFile, 'utf8'));
  assert.equal(persisted.receiptSha256, report.receiptSha256);
});
