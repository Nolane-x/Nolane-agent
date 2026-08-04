import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyRemainingCompletion } from '../src/release/remaining-completion-verifier.mjs';

test('remaining completion verifier proves browser/secrets and preserves native runtime gates with probe evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-completion-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyRemainingCompletion({ rootDirectory: path.resolve('.'), version: '2.8.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.audit, { verifiedBrowserAndSecrets: ['4.21', '4.30'], externalNativeRuntime: ['13.27', '21.4', '21.6', '21.7'], notImplementedCount: 0, frontierNotImplementedCount: 0 });
  assert.equal(report.runtimeEvidence.treeSitter.externalRuntime, true);
  assert.equal(report.runtimeEvidence.podman.externalRuntime, true);
  assert.equal(report.runtimeEvidence.windowsJobObjects.nativeHelperRequired, true);
  assert.equal(report.runtimeEvidence.macOsSandbox.externalOsRuntime, true);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});


test('remaining completion verifier scopes legacy completion to the baseline 790 requirements and reports frontier backlog separately', async () => {
  const report = await verifyRemainingCompletion({ rootDirectory: path.resolve('.'), version: '2.20.0' });
  assert.equal(report.status, 'pass');
  assert.equal(report.audit.notImplementedCount, 0);
  assert.equal(report.audit.frontierNotImplementedCount, 328);
});
