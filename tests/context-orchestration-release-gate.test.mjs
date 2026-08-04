import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyContextOrchestration } from '../src/release/context-orchestration-verifier.mjs';

test('context orchestration release verifier proves priority, compaction, accounting, budgets, checkpointing, API, UI, and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-context-orchestration-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyContextOrchestration({ rootDirectory: path.resolve('.'), version: '2.1.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'current-error-priority','old-log-decay','conversation-and-file-compaction','freshness-and-staleness',
    'per-source-token-accounting','role-specific-budgets','permission-filtering','durable-checkpoints','cursor-paging',
    'authenticated-api','observable-control-center','full-release-matrix-gate',
  ]);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
