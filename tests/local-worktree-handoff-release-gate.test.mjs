import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyLocalWorktreeHandoff } from '../src/release/local-worktree-handoff-verifier.mjs';

test('local worktree handoff verifier proves service, bounded API, VS Code opening, audit movement, matrix, and non-claims', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-local-worktree-handoff-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyLocalWorktreeHandoff({ rootDirectory: path.resolve('.'), version: '2.6.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'authenticated-principal-bound-transfer',
    'managed-builder-integrator-worktree',
    'content-addressed-idempotent-handoff',
    'bounded-api-without-path-input',
    'vscode-transfer-local-command',
    'vscode-open-folder-without-shell',
    'item-level-feature-audit',
    'full-release-matrix-gate',
  ]);
  assert.equal(report.limitations.cloudTransferClaimed, false);
  assert.equal(report.limitations.arbitraryPathOpenClaimed, false);
  assert.equal(report.limitations.shellExecutionClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
