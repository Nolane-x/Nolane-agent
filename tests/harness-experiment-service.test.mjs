import assert from 'node:assert/strict';
import test from 'node:test';

import { HarnessExperimentService } from '../src/providers/harness-experiment-service.mjs';
import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';

const suite = Object.freeze({
  id: 'harness-replay',
  cases: Object.freeze([
    Object.freeze({ id: 'critical-tool-schema', critical: true, assertions: { state: 'awaiting-verification', maxToolCalls: 6 } }),
    Object.freeze({ id: 'patch-flow', assertions: { state: 'awaiting-verification', maxToolCalls: 6 } }),
    Object.freeze({ id: 'retry-recovery', assertions: { state: 'awaiting-verification', maxToolCalls: 6 } }),
    Object.freeze({ id: 'context-bounded', assertions: { state: 'awaiting-verification', maxToolCalls: 6 } }),
  ]),
});

function candidate(id, revision) {
  return {
    id, family: 'codex-cli', revision, status: 'candidate',
    systemDirectives: ['Use exact tools.', 'Keep patches bounded.'],
    contextStrategy: 'evidence-first', toolStrategy: 'patch-first', patchStrategy: 'patch-set-first',
    retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' }, errorRendering: 'classified-actionable',
    maxToolSchemas: 48, maxDirectiveChars: 1200,
  };
}

function setup() {
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  const baseline = registry.resolve({ harnessFamily: 'codex-cli' });
  const weak = registry.registerCandidate(candidate('codex-cli-weak-v2', 2));
  const strong = registry.registerCandidate(candidate('codex-cli-strong-v3', 3));
  let now = 0;
  const experiments = new HarnessExperimentService({ clock: () => ++now, minImprovement: 0.01 });
  return { registry, baseline, weak, strong, experiments };
}

test('replay rejects a candidate with a new critical regression', async () => {
  const { registry, baseline, weak, experiments } = setup();
  const report = await experiments.compare({
    family: 'codex-cli', baseline, candidate: weak, suite,
    executor: async ({ profile, evalCase }) => ({
      state: profile.id === weak.id && evalCase.id === 'critical-tool-schema' ? 'failed' : 'awaiting-verification',
      output: profile.id, toolCalls: 2, retries: 0, estimatedTokens: 100, evidence: [],
    }),
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.promotable, false);
  assert.equal(report.criticalRegressions, 1);
  assert.ok(report.failures.includes('candidate introduced 1 critical regression(s)'));
  assert.throws(() => registry.promote({ family: 'codex-cli', candidateId: weak.id, report }), /not promotable/);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('replay accepts a non-regressing candidate with a measurable efficiency improvement', async () => {
  const { registry, baseline, strong, experiments } = setup();
  const report = await experiments.compare({
    family: 'codex-cli', baseline, candidate: strong, suite,
    executor: async ({ profile }) => ({
      state: 'awaiting-verification', output: profile.id,
      toolCalls: profile.id === baseline.id ? 6 : 2,
      retries: profile.id === baseline.id ? 1 : 0,
      estimatedTokens: profile.id === baseline.id ? 400 : 100,
      evidence: [],
    }),
  });
  assert.equal(report.promotable, true);
  assert.equal(report.baseline.passRate, 1);
  assert.equal(report.candidate.passRate, 1);
  assert.ok(report.candidate.weightedScore > report.baseline.weightedScore);
  const promotion = registry.promote({ family: 'codex-cli', candidateId: strong.id, report, actor: 'test' });
  assert.equal(promotion.activeProfileId, strong.id);
  assert.equal(registry.rollback({ family: 'codex-cli', actor: 'test' }).activeProfileId, baseline.id);
});

test('replay requires same-family profiles and at least four cases', async () => {
  const { baseline, strong, experiments } = setup();
  await assert.rejects(() => experiments.compare({ family: 'claude-code', baseline, candidate: strong, suite, executor: async () => ({ state: 'awaiting-verification' }) }), /family/);
  await assert.rejects(() => experiments.compare({ family: 'codex-cli', baseline, candidate: strong, suite: { id: 'too-small', cases: suite.cases.slice(0, 3) }, executor: async () => ({ state: 'awaiting-verification' }) }), /at least 4/);
});
