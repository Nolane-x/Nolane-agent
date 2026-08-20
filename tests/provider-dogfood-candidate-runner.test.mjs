import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDER_DOGFOOD_PROFILE_V1,
  providerDogfoodProfileDescriptor,
  runProviderDogfoodCandidate,
  sha256Text,
} from '../src/providers/provider-dogfood-candidate-runner.mjs';

function collectKeys(value, target = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, target);
    return target;
  }
  if (!value || typeof value !== 'object') return target;
  for (const [key, item] of Object.entries(value)) {
    target.push(key);
    collectKeys(item, target);
  }
  return target;
}

function assertHash(value) {
  assert.match(value, /^[0-9a-f]{64}$/);
}

test('provider dogfood profile is stable, bounded, and contains 10 behavioral plus 12 adversarial cases', () => {
  assert.equal(PROVIDER_DOGFOOD_PROFILE_V1.version, 'provider-real-dogfood.v1');
  assert.equal(PROVIDER_DOGFOOD_PROFILE_V1.cases.length, 22);
  assert.equal(PROVIDER_DOGFOOD_PROFILE_V1.cases.filter((item) => item.kind === 'behavior').length, 10);
  assert.equal(PROVIDER_DOGFOOD_PROFILE_V1.cases.filter((item) => item.kind === 'adversarial_probe').length, 12);
  assert.equal(new Set(PROVIDER_DOGFOOD_PROFILE_V1.cases.map((item) => item.id)).size, 22);
  assert.ok(PROVIDER_DOGFOOD_PROFILE_V1.cases.every((item) => typeof item.prompt === 'string' && item.prompt.length > 0));

  const descriptor = providerDogfoodProfileDescriptor();
  assert.equal(descriptor.total_cases, 22);
  assert.equal(descriptor.behavioral_cases, 10);
  assert.equal(descriptor.adversarial_probes, 12);
  assertHash(descriptor.sha256);
  assert.equal(JSON.stringify(descriptor).includes('prompt'), false);
});

test('candidate runner executes sequentially, tears down every case, and emits hash-only evidence', async () => {
  let active = 0;
  let maxActive = 0;
  let invokes = 0;
  let teardowns = 0;
  const rawOutputs = [];
  const provider = {
    id: 'fake-safe',
    executionSafety: 'verified',
    publicView() {
      return {
        id: 'fake-safe',
        executable: 'fake-safe-cli',
        baseArgs: ['--plan', '--json'],
        executionSafety: 'verified',
        secretEnvKeys: ['SHOULD_NEVER_APPEAR'],
      };
    },
    async invoke({ prompt }) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      invokes += 1;
      await new Promise((resolve) => setTimeout(resolve, 1));
      const stdout = `RAW-SECRET-OUTPUT-${invokes}:${prompt.slice(0, 12)}`;
      rawOutputs.push(stdout);
      active -= 1;
      return { exitCode: invokes === 7 ? 7 : 0, stdout, stderr: 'PRIVATE-STDERR', timedOut: false, aborted: false };
    },
  };

  const candidate = await runProviderDogfoodCandidate({
    provider,
    workspace: 'C:/isolated/provider-dogfood',
    machineLabel: 'windows-self-hosted-fixture',
    model: 'fixture-model',
    teardownCase: async () => { teardowns += 1; },
  });

  assert.equal(invokes, 22);
  assert.equal(teardowns, 22);
  assert.equal(maxActive, 1);
  assert.equal(candidate.schema_version, 'nolane.provider-dogfood-candidate.v1');
  assert.equal(candidate.evidence_kind, 'provider_real_dogfood_candidate');
  assert.equal(candidate.certification_state, 'candidate_unverified');
  assert.equal(candidate.final_decision, 'external_gate');
  assert.equal(candidate.profile.total_cases, 22);
  assert.equal(candidate.cases.length, 22);
  assert.equal(candidate.summary.total, 22);
  assert.equal(candidate.summary.completed, 22);
  assert.equal(candidate.summary.failed, 1);
  assert.equal(candidate.provider.id, 'fake-safe');
  assert.equal(candidate.provider.executable, 'fake-safe-cli');
  assert.deepEqual(candidate.provider.public_args, ['--plan', '--json']);
  assert.equal(candidate.provider.execution_safety, 'verified');

  for (const item of candidate.cases) {
    assertHash(item.input_sha256);
    assertHash(item.output_sha256);
    assert.equal(Number.isInteger(item.output_bytes), true);
    assert.equal(typeof item.duration_ms, 'number');
    assert.equal(typeof item.started_at, 'string');
    assert.equal(typeof item.finished_at, 'string');
  }
  assert.equal(candidate.cases[6].status, 'failed');
  assert.equal(candidate.cases[6].error_code, 'provider_exit_nonzero');
  assert.equal(candidate.cases[6].output_sha256, sha256Text(rawOutputs[6]));

  const keys = collectKeys(candidate);
  for (const forbidden of ['prompt', 'output', 'stdout', 'stderr', 'transcript', 'pass', 'passed', 'messages']) {
    assert.equal(keys.includes(forbidden), false, `candidate leaked forbidden field: ${forbidden}`);
  }
  const serialized = JSON.stringify(candidate);
  assert.equal(serialized.includes('RAW-SECRET-OUTPUT'), false);
  assert.equal(serialized.includes('PRIVATE-STDERR'), false);
  assert.equal(serialized.includes('SHOULD_NEVER_APPEAR'), false);
  assert.equal(serialized.includes('fixture-model'), false, 'model selector must not be persisted into candidate evidence');
  for (const profileCase of PROVIDER_DOGFOOD_PROFILE_V1.cases) assert.equal(serialized.includes(profileCase.prompt), false);
});

test('candidate runner records invocation exceptions without leaking diagnostics and continues remaining cases', async () => {
  let invokes = 0;
  let teardowns = 0;
  const provider = {
    id: 'exception-fixture',
    executionSafety: 'verified',
    publicView: () => ({ id: 'exception-fixture', executable: 'fixture', baseArgs: [], executionSafety: 'verified' }),
    async invoke() {
      invokes += 1;
      if (invokes === 3) throw new Error('apiKey=PRIVATE invocation transcript');
      return { exitCode: 0, stdout: `safe-output-${invokes}`, stderr: '' };
    },
  };

  const candidate = await runProviderDogfoodCandidate({ provider, workspace: '/tmp/fixture', teardownCase: async () => { teardowns += 1; } });
  assert.equal(invokes, 22);
  assert.equal(teardowns, 22);
  assert.equal(candidate.summary.failed, 1);
  assert.equal(candidate.cases[2].status, 'failed');
  assert.equal(candidate.cases[2].error_code, 'provider_invocation_error');
  assert.equal(candidate.cases[2].output_bytes, 0);
  assert.equal(candidate.cases[2].output_sha256, sha256Text(''));
  assert.equal(JSON.stringify(candidate).includes('PRIVATE'), false);
});
