import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { buildNodeTestArgs, buildNodeTestPlan, countDotReporterTests } from '../scripts/run-node-test-suite.mjs';

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
    'model-provider.test.mjs',
    'nolane-native-capability-pack.test.mjs',
    'small-model-checkpoint-6-foundation.test.mjs',
    'small-model-checkpoint-7-foundation.test.mjs',
    'small-model-checkpoint-7-http.test.mjs',
  ]) {
    assert.ok(isolatedNames.has(expected), `${expected} must run in the isolated phase`);
  }
  assert.ok(plan.parallel.length > plan.isolated.length);
  assert.deepEqual(plan.serial.map((file) => path.basename(file)), [
    'adaptive-microkernel-app-wiring.test.mjs',
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


test('node suite runner uses a concise reporter with bounded force-exit after test completion', () => {
  const args = buildNodeTestArgs(['/tmp/example.test.mjs'], { concurrency: 8 });
  assert.ok(args.includes('--test-reporter=dot'));
  assert.ok(args.includes('--test-concurrency=8'));
  assert.ok(args.includes('--test-force-exit'));
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
