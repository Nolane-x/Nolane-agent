import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { validateVsCodeExtension } from '../scripts/validate-vscode-extension.mjs';
import { runSelfBenchmark } from '../scripts/run-benchmarks.mjs';
import { VERSION } from '../src/version.mjs';

const execFileAsync = promisify(execFile);

test('VS Code extension rebuilds from tracked TypeScript source in a clean tree', async () => {
  await rm('extensions/vscode/extension/dist', { recursive: true, force: true });
  await execFileAsync(process.execPath, ['scripts/build-vscode-extension.mjs'], { timeout: 60_000, windowsHide: true });
  const report = await validateVsCodeExtension({ root: 'extensions/vscode', expectedVersion: VERSION });
  assert.equal(report.schema, 'nolane.agent.vscode-validation.v1');
  assert.equal(report.product, 'Nolane Agent');
  assert.equal(report.version, VERSION);
  assert.equal(report.compiledJavaScriptFiles, 3);
  assert.equal(report.httpsOrLoopbackEnforced, true);
  assert.equal(report.secretStorageUsed, true);
  assert.equal(report.sourceAvailability, 'tracked-typescript-source');
  assert.equal(report.safeLocalWorktreeOpen, true);
});

test('self benchmark creates a non-independent report that cannot unlock comparative claims', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-self-benchmark-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await runSelfBenchmark({ outputDirectory: output });
  assert.equal(report.independent, false);
  assert.equal(report.claimAllowed, false);
  assert.equal(report.runs.length, 3);
  assert.equal(report.runs.every((run) => run.verified), true);
  assert.match(await readFile(path.join(output, 'benchmark-report.md'), 'utf8'), /Comparative claim allowed: no/);
});
