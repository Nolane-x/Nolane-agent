import assert from 'node:assert/strict';
import test from 'node:test';

import { HarnessCanaryController } from '../src/providers/harness-canary-controller.mjs';
import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';

function candidate() {
  return {
    id: 'codex-cli-canary-v2', family: 'codex-cli', revision: 2, status: 'candidate',
    systemDirectives: ['Use exact tools.', 'Verify each bounded change.'],
    contextStrategy: 'evidence-first', toolStrategy: 'patch-first', patchStrategy: 'patch-set-first',
    retryPolicy: { maxRetries: 2, backoff: 'provider-native' }, errorRendering: 'structured-recovery',
    maxToolSchemas: 48, maxDirectiveChars: 1200,
  };
}

function setup(options = {}) {
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  const canary = registry.registerCandidate(candidate());
  const controller = new HarnessCanaryController({ registry, ...options });
  controller.configure({ family: 'codex-cli', candidateId: canary.id, percentage: 20, minSamples: 4, maxPassRateRegression: 0.1, maxResourceRegression: 0.25 });
  return { registry, canary, controller };
}

test('HarnessCanaryController assigns deterministic bounded cohorts', () => {
  const { canary, controller } = setup();
  const stableScope = { family: 'codex-cli', projectId: 'p1', missionId: 'm1' };
  assert.deepEqual(controller.assign(stableScope), controller.assign(stableScope));
  let candidateCount = 0;
  for (let index = 0; index < 1000; index += 1) {
    const assignment = controller.assign({ family: 'codex-cli', projectId: `p${index}`, missionId: `m${index}` });
    if (assignment.profileId === canary.id) candidateCount += 1;
  }
  assert.ok(candidateCount >= 170 && candidateCount <= 230, `candidate count ${candidateCount}`);
  assert.match(controller.assign(stableScope).receiptSha256, /^[a-f0-9]{64}$/);
});

test('HarnessCanaryController disables a regressing candidate after minimum samples', () => {
  const { canary, controller } = setup();
  for (let index = 0; index < 6; index += 1) controller.recordOutcome({ family: 'codex-cli', profileId: 'codex-cli-v1', cohort: 'stable', passed: true, latencyMs: 100, peakRssBytes: 100 });
  for (let index = 0; index < 4; index += 1) controller.recordOutcome({ family: 'codex-cli', profileId: canary.id, cohort: 'candidate', passed: index === 0, latencyMs: 120, peakRssBytes: 110 });
  const evaluation = controller.evaluate(canary.id);
  assert.equal(evaluation.enabled, false);
  assert.equal(evaluation.decision, 'disable-regression');
  assert.ok(evaluation.reasons.some((reason) => /pass rate/i.test(reason)));
  const assignment = controller.assign({ family: 'codex-cli', projectId: 'forced-stable', missionId: 'm' });
  assert.equal(assignment.profileId, 'codex-cli-v1');
});

test('HarnessCanaryController keeps a non-regressing candidate enabled and records no raw payload', () => {
  const { canary, controller } = setup();
  for (let index = 0; index < 6; index += 1) controller.recordOutcome({ family: 'codex-cli', profileId: 'codex-cli-v1', cohort: 'stable', passed: index < 5, latencyMs: 100, peakRssBytes: 100 });
  for (let index = 0; index < 4; index += 1) controller.recordOutcome({ family: 'codex-cli', profileId: canary.id, cohort: 'candidate', passed: true, latencyMs: 90, peakRssBytes: 95, prompt: 'private prompt', output: 'private output', metadata: { token: 'SECRET' } });
  const evaluation = controller.evaluate(canary.id);
  assert.equal(evaluation.enabled, true);
  assert.equal(evaluation.decision, 'continue');
  const serialized = JSON.stringify(controller.snapshot());
  assert.equal(serialized.includes('private prompt'), false);
  assert.equal(serialized.includes('private output'), false);
  assert.equal(serialized.includes('SECRET'), false);
});

test('HarnessCanaryController supports immediate operator disable', () => {
  const { canary, controller } = setup();
  const disabled = controller.disable(canary.id, 'operator safety stop');
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.reason, 'operator safety stop');
});
