import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROVIDER_DOGFOOD_PROFILE_V1,
  runProviderDogfoodCandidate,
} from '../src/providers/provider-dogfood-candidate-runner.mjs';
import { validateProviderDogfoodCandidate } from '../scripts/run-provider-dogfood-candidate.mjs';

async function validCandidate() {
  const provider = {
    id: 'test-provider',
    executable: 'test-provider',
    baseArgs: ['--plan'],
    executionSafety: 'verified',
    publicView() {
      return {
        id: this.id,
        executable: this.executable,
        executionSafety: this.executionSafety,
      };
    },
    async invoke() {
      return { stdout: 'ok', stderr: '', exitCode: 0, timedOut: false, aborted: false };
    },
  };
  let clock = Date.parse('2026-08-14T00:00:00.000Z');
  return runProviderDogfoodCandidate({
    provider,
    workspace: '/isolated/dogfood',
    now: () => clock++,
  });
}

function clone(value) {
  return structuredClone(value);
}

function rejectsCandidate(candidate, message) {
  assert.throws(
    () => validateProviderDogfoodCandidate(candidate),
    (error) => error?.code === 'DOGFOOD_CANDIDATE_INVALID',
    message,
  );
}

test('provider dogfood validator accepts the canonical 22-case candidate', async () => {
  const candidate = await validCandidate();
  assert.equal(validateProviderDogfoodCandidate(candidate), candidate);
  assert.equal(candidate.cases.length, PROVIDER_DOGFOOD_PROFILE_V1.cases.length);
});

test('provider dogfood validator rejects missing and truncated case evidence', async () => {
  const candidate = await validCandidate();

  const missing = clone(candidate);
  delete missing.cases;
  rejectsCandidate(missing, 'missing cases must fail closed');

  const truncated = clone(candidate);
  truncated.cases.pop();
  truncated.summary.total -= 1;
  truncated.summary.completed -= 1;
  rejectsCandidate(truncated, 'a self-consistent but incomplete case set must fail closed');
});

test('provider dogfood validator rejects profile, case identity, and summary tampering', async () => {
  const candidate = await validCandidate();

  const profile = clone(candidate);
  profile.profile.total_cases = 1;
  rejectsCandidate(profile, 'profile counts must match the canonical profile');

  const caseIdentity = clone(candidate);
  caseIdentity.cases[0].id = 'behavior-forged';
  rejectsCandidate(caseIdentity, 'case identity must be bound to the canonical profile');

  const inputHash = clone(candidate);
  inputHash.cases[0].input_sha256 = '0'.repeat(64);
  rejectsCandidate(inputHash, 'input digest must be bound to the canonical prompt');

  const summary = clone(candidate);
  summary.summary.failed = 1;
  rejectsCandidate(summary, 'summary must match case outcomes');
});

test('provider dogfood validator rejects evidence from a provider not marked verified', async () => {
  const candidate = clone(await validCandidate());
  candidate.provider.execution_safety = 'external-plan-config-required';
  rejectsCandidate(candidate, 'candidate provider safety must remain verified');
});
