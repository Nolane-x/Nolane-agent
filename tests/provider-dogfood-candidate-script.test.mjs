import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createDogfoodProviderRegistry,
  parseProviderDogfoodArgs,
  runProviderDogfoodCommand,
} from '../scripts/run-provider-dogfood-candidate.mjs';
import { runProviderDogfoodCandidate } from '../src/providers/provider-dogfood-candidate-runner.mjs';

function safeFakeProvider(invocations) {
  return {
    id: 'fixture-safe',
    executionSafety: 'verified',
    publicView: () => ({ id: 'fixture-safe', executable: 'fixture', baseArgs: ['--plan'], executionSafety: 'verified' }),
    invoke: async () => { invocations.count += 1; return { exitCode: 0, stdout: 'ok', stderr: '' }; },
  };
}

test('provider dogfood CLI parser requires explicit provider, workspace, output, and acknowledgement', () => {
  const parsed = parseProviderDogfoodArgs([
    '--provider', 'codex', '--workspace', 'C:/dogfood', '--output', 'C:/evidence/candidate.json', '--acknowledge-real-provider-run', '--model', 'fixture', '--machine-label', 'host-1',
  ]);
  assert.equal(parsed.provider, 'codex');
  assert.equal(parsed.workspace, 'C:/dogfood');
  assert.equal(parsed.output, 'C:/evidence/candidate.json');
  assert.equal(parsed.acknowledgeRealProviderRun, true);
  assert.equal(parsed.model, 'fixture');
  assert.equal(parsed.machineLabel, 'host-1');
  assert.throws(() => parseProviderDogfoodArgs(['--provider', 'codex']), /workspace/i);
});

test('dogfood registry is populated from the production built-in provider factory', () => {
  const registry = createDogfoodProviderRegistry();
  const ids = registry.list().map((provider) => provider.id);
  assert.ok(ids.includes('codex'));
  assert.ok(ids.includes('kimi-code'));
  assert.ok(ids.length >= 20);
});

test('command fails closed before candidate execution for an unsafe built-in provider', async () => {
  let runCalls = 0;
  await assert.rejects(
    () => runProviderDogfoodCommand({
      argv: ['--provider', 'kimi-code', '--workspace', 'C:/dogfood', '--output', 'C:/candidate.json', '--acknowledge-real-provider-run'],
      env: { NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN: '1', GITHUB_EVENT_NAME: 'workflow_dispatch' },
      deps: { runCandidate: async () => { runCalls += 1; return {}; } },
    }),
    (error) => error?.code === 'DOGFOOD_PROVIDER_EXECUTION_UNSAFE',
  );
  assert.equal(runCalls, 0);
});

test('command fails closed without the environment guard or outside workflow_dispatch', async () => {
  const argv = ['--provider', 'codex', '--workspace', 'C:/dogfood', '--output', 'C:/candidate.json', '--acknowledge-real-provider-run'];
  await assert.rejects(
    () => runProviderDogfoodCommand({ argv, env: {}, deps: { runCandidate: async () => ({}) } }),
    (error) => error?.code === 'DOGFOOD_REAL_RUN_GUARD_REQUIRED',
  );
  await assert.rejects(
    () => runProviderDogfoodCommand({ argv, env: { NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN: '1', GITHUB_EVENT_NAME: 'push' }, deps: { runCandidate: async () => ({}) } }),
    (error) => error?.code === 'DOGFOOD_MANUAL_DISPATCH_REQUIRED',
  );
  await assert.rejects(
    () => runProviderDogfoodCommand({ argv, env: { NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN: '1' }, deps: { runCandidate: async () => ({}) } }),
    (error) => error?.code === 'DOGFOOD_MANUAL_DISPATCH_REQUIRED',
  );
});

test('command writes only the finalized candidate and never stores provider plaintext', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-dogfood-script-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'evidence', 'candidate.json');
  const invocations = { count: 0 };
  const provider = safeFakeProvider(invocations);
  const registry = { get(id) { if (id !== provider.id) throw new Error('unknown'); return provider; } };

  const result = await runProviderDogfoodCommand({
    argv: ['--provider', provider.id, '--workspace', root, '--output', output, '--acknowledge-real-provider-run'],
    env: { NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN: '1', GITHUB_EVENT_NAME: 'workflow_dispatch' },
    deps: {
      registry,
      runCandidate: async ({ provider: selected, workspace, model, machineLabel }) => {
        assert.equal(selected, provider);
        return runProviderDogfoodCandidate({ provider: selected, workspace, model, machineLabel });
      },
    },
  });
  assert.equal(result.final_decision, 'external_gate');
  assert.equal(result.cases.length, 22);
  assert.equal(invocations.count, 22);
  const persisted = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(persisted, result);
  const serialized = JSON.stringify(persisted);
  assert.equal(serialized.includes('"prompt":'), false);
  assert.equal(serialized.includes('"stdout":'), false);
});

test('command rejects a candidate that attempts to self-certify or persist raw content', async () => {
  const provider = safeFakeProvider({ count: 0 });
  const registry = { get: () => provider };
  const base = ['--provider', provider.id, '--workspace', 'C:/dogfood', '--output', 'C:/candidate.json', '--acknowledge-real-provider-run'];
  for (const poisoned of [
    { certification_state: 'verified', final_decision: 'pass' },
    { certification_state: 'candidate_unverified', final_decision: 'external_gate', prompt: 'secret' },
    { certification_state: 'candidate_unverified', final_decision: 'external_gate', stdout: 'secret' },
  ]) {
    await assert.rejects(
      () => runProviderDogfoodCommand({
        argv: base,
        env: { NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN: '1', GITHUB_EVENT_NAME: 'workflow_dispatch' },
        deps: { registry, runCandidate: async () => poisoned, writeCandidate: async () => assert.fail('invalid candidate must never be written') },
      }),
      (error) => error?.code === 'DOGFOOD_CANDIDATE_INVALID',
    );
  }
});
