import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { buildNodeTestArgs, buildNodeTestPlan, countDotReporterTests, resolveParallelWorkerCount, runNodeTestFilePool } from '../scripts/run-node-test-suite.mjs';

test('node suite runner covers every test exactly once and isolates packaging', async () => {
  const plan = await buildNodeTestPlan(path.resolve('tests'));
  const all = [...plan.parallel, ...plan.isolated];
  assert.equal(new Set(all).size, all.length, 'test files must not be duplicated');
  assert.equal(all.length, plan.discovered.length, 'every discovered test file must be scheduled');
  assert.deepEqual([...all].sort(), [...plan.discovered].sort());
  const isolatedNames = new Set(plan.isolated.map((file) => path.basename(file)));
  for (const expected of [
    'electron-packaging.test.mjs',
    'nolane-program-registry.test.mjs',
    'packaging.test.mjs',
    'performance.test.mjs',
    'project-manifest-generation.test.mjs',
    'release-artifacts.test.mjs',
    'release-tooling.test.mjs',
    'source-reconstruction.test.mjs',
    'update-release-tools.test.mjs',
    'worktree-integration-service.test.mjs',
    'vscode-collaboration-experience.test.mjs',
    'vscode-legacy-migration.test.mjs',
    'vscode-local-worktree-handoff.test.mjs',
    'vscode-mission-state-bridge.test.mjs',
    'vscode-security-certification-state.test.mjs',
    'tool-broker.test.mjs',
    'terminal-service.test.mjs',
    'adaptive-microkernel-app-wiring.test.mjs',
    'code-intelligence-v2.test.mjs',
    'codex-app-server.test.mjs',
    'codex-session-reuse.test.mjs',
    'model-provider.test.mjs',
    'nolane-native-capability-pack.test.mjs',
    'small-model-checkpoint-6-foundation.test.mjs',
    'small-model-checkpoint-7-foundation.test.mjs',
    'small-model-checkpoint-7-http.test.mjs',
    'execution-process-lifecycle-contracts.test.mjs',
  ]) {
    assert.ok(isolatedNames.has(expected), `${expected} must run in the isolated phase`);
  }
  assert.ok(plan.parallel.length > plan.isolated.length);
  assert.deepEqual(plan.serial.map((file) => path.basename(file)), [
    'adaptive-microkernel-app-wiring.test.mjs',
    'code-intelligence-v2.test.mjs',
    'codex-app-server.test.mjs',
    'codex-session-reuse.test.mjs',
    'execution-process-lifecycle-contracts.test.mjs',
    'model-provider.test.mjs',
    'nolane-native-capability-pack.test.mjs',
    'nolane-program-registry.test.mjs',
    'packaging.test.mjs',
    'release-artifacts.test.mjs',
    'release-tooling.test.mjs',
    'small-model-checkpoint-6-foundation.test.mjs',
    'small-model-checkpoint-7-foundation.test.mjs',
    'small-model-checkpoint-7-http.test.mjs',
    'vscode-collaboration-experience.test.mjs',
    'vscode-legacy-migration.test.mjs',
    'vscode-local-worktree-handoff.test.mjs',
    'vscode-mission-state-bridge.test.mjs',
    'vscode-security-certification-state.test.mjs',
  ]);
  assert.equal(plan.isolatedBatch.length + plan.serial.length, plan.isolated.length);
  assert.equal(plan.isolatedBatch.includes(plan.serial[0]), false);
  assert.ok(plan.parallelBatches.length > 1);
  assert.ok(plan.parallelBatches.every((batch) => batch.length <= 32));
  assert.ok(plan.parallelBatches.length === Math.ceil(plan.parallel.length / 32), 'parallel plan should use bounded 32-file batches to avoid resource contention');
  assert.deepEqual(plan.parallelBatches.flat(), plan.parallel);
});

test('node suite runner can explicitly skip local packaging smoke without weakening the default CI plan', async () => {
  const plan = await buildNodeTestPlan(path.resolve('tests'), { skipLocalPackagingSmoke: true });
  const scheduled = [...plan.parallel, ...plan.isolated].map((file) => path.basename(file));

  assert.deepEqual(plan.skipped.map((file) => path.basename(file)), [
    'electron-packaging.test.mjs',
    'packaging.test.mjs',
  ]);
  assert.equal(scheduled.includes('electron-packaging.test.mjs'), false);
  assert.equal(scheduled.includes('packaging.test.mjs'), false);
  assert.equal(plan.discovered.length, scheduled.length + plan.skipped.length);
});


test('node suite runner uses a concise reporter with bounded force-exit after test completion', () => {
  const args = buildNodeTestArgs(['/tmp/example.test.mjs'], { concurrency: 8 });
  assert.ok(args.includes('--test-reporter=dot'));
  assert.ok(args.includes('--test-concurrency=8'));
  assert.ok(args.includes('--test-force-exit'));
});


test('node suite runner lets HTTP boundary tests close their server gracefully', () => {
  const args = buildNodeTestArgs(['tests/http-boundary-errors.test.mjs'], { concurrency: 1 });
  assert.ok(args.includes('--test-reporter=dot'));
  assert.equal(args.includes('--test-force-exit'), false);
});


test('node suite runner lets HTTP API fixtures close their server gracefully', () => {
  const args = buildNodeTestArgs(['tests/instruction-policy-http-api.test.mjs'], { concurrency: 1 });
  assert.equal(args.includes('--test-force-exit'), false);
});


test('node suite runner lets LSP child fixtures close gracefully', () => {
  const args = buildNodeTestArgs(['tests/lsp-intelligence.test.mjs'], { concurrency: 1 });
  assert.equal(args.includes('--test-force-exit'), false);
});


test('node suite runner lets route telemetry fixtures close gracefully', () => {
  const args = buildNodeTestArgs(['tests/route-security-telemetry.test.mjs'], { concurrency: 1 });
  assert.equal(args.includes('--test-force-exit'), false);
});

test('node suite runner reduces default parallelism under memory pressure without overriding explicit modes', () => {
  const gigabyte = 1024 ** 3;
  const noConfiguredWorkers = Number.NaN;

  assert.equal(resolveParallelWorkerCount({ configuredWorkers: noConfiguredWorkers, freeMemoryBytes: 700 * 1024 ** 2 }), 1);
  assert.equal(resolveParallelWorkerCount({ configuredWorkers: noConfiguredWorkers, freeMemoryBytes: 2 * gigabyte }), 2);
  assert.equal(resolveParallelWorkerCount({ configuredWorkers: noConfiguredWorkers, freeMemoryBytes: 4 * gigabyte }), 4);
  assert.equal(resolveParallelWorkerCount({ configuredWorkers: 12, freeMemoryBytes: 1 }), 12);
  assert.equal(resolveParallelWorkerCount({ configuredWorkers: noConfiguredWorkers, cleanRoom: true, freeMemoryBytes: 1 }), 32);
});


test('node suite runner retries one transient isolated-file startup failure without masking a second failure', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-node-runner-retry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marker = path.join(root, 'first-run.marker');
  const poolMarker = path.join(root, 'pool-drained.marker');
  const fixture = path.join(root, 'transient.test.mjs');
  const holder = path.join(root, 'pool-holder.test.mjs');
  await writeFile(fixture, `
    import { existsSync, writeFileSync } from 'node:fs';
    import test from 'node:test';
    import assert from 'node:assert/strict';
    const marker = ${JSON.stringify(marker)};
    const poolMarker = ${JSON.stringify(poolMarker)};
    if (!existsSync(marker)) {
      writeFileSync(marker, 'first attempt');
      test('transient startup failure', () => { throw new Error('synthetic startup contention'); });
    } else if (!existsSync(poolMarker)) {
      test('retry waits for the active pool to drain', () => { throw new Error('retry started while another worker was active'); });
    } else {
      test('retry succeeds', () => assert.equal(1, 1));
    }
  `);
  await writeFile(holder, `
    import { writeFileSync } from 'node:fs';
    import test from 'node:test';
    import assert from 'node:assert/strict';
    const poolMarker = ${JSON.stringify(poolMarker)};
    test('keeps the worker pool occupied during retry', async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      writeFileSync(poolMarker, 'pool drained');
      assert.equal(1, 1);
    });
  `);
  const count = await runNodeTestFilePool([fixture, holder], { concurrency: 2, label: 'Retry fixture' });
  assert.equal(count, 2);
});


test('dot reporter counter counts pass and failure markers only', () => {
  assert.equal(countDotReporterTests('..\n.X\n'), 4);
  assert.equal(countDotReporterTests('\u001b[32m.\u001b[0m\n\u001b[31mX\u001b[0m\n'), 2);
  assert.equal(countDotReporterTests('header without markers'), 0);
});


test('node suite runner waits for child stdio to close before starting the next phase', async () => {
  const source = await readFile('scripts/run-node-test-suite.mjs', 'utf8');
  assert.match(source, /child\.once\('close'/);
  assert.doesNotMatch(source, /child\.once\('exit'/);
  assert.match(source, /NOLANE_AGENT_CLEAN_ROOM/);
});
