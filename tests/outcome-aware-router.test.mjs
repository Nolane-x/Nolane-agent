import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { OutcomeMetricsStore, OutcomeAwareProviderRouter } from '../src/providers/outcome-aware-router.mjs';

function registry(providers) {
  const values = new Map(providers.map((provider) => [provider.id, provider]));
  return {
    list: () => [...values.values()],
    get: (id) => { const value = values.get(id); if (!value) throw new Error(`Unknown provider: ${id}`); return value; },
    detection: () => ({ available: true, authenticated: true, healthy: true }),
  };
}

function provider(id, profile) {
  return { id, profile, publicView: () => ({ id, ...profile }) };
}

test('OutcomeMetricsStore persists verified retention and correction signals without prompt content', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-router-outcomes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'outcomes.sqlite');
  const first = new OutcomeMetricsStore({ file });
  first.record({ providerId: 'deep', taskKind: 'debug', verified: true, accepted: true, retainedLines: 90, generatedLines: 100, correctionCount: 0, costUsd: 0.4, latencyMs: 2_000 });
  first.record({ providerId: 'cheap', taskKind: 'debug', verified: false, accepted: false, retainedLines: 10, generatedLines: 100, correctionCount: 3, costUsd: 0.05, latencyMs: 400 });
  first.close();

  const reopened = new OutcomeMetricsStore({ file });
  const deep = reopened.summary('deep', 'debug');
  const cheap = reopened.summary('cheap', 'debug');
  assert.equal(deep.samples, 1);
  assert.equal(deep.retentionRate, 0.9);
  assert.equal(deep.verifiedRate, 1);
  assert.equal(cheap.verifiedRate, 0);
  assert.equal(reopened.publicView().some((item) => Object.hasOwn(item, 'prompt')), false);
  reopened.close();
});

test('OutcomeAwareProviderRouter changes trade-offs across intelligence balance and cost modes', () => {
  const providers = registry([
    provider('fast', { capabilities: ['coding', 'tool-calling'], qualityTier: 3, costTier: 1, latencyTier: 1, contextTier: 2 }),
    provider('deep', { capabilities: ['coding', 'tool-calling', 'long-context', 'vision'], qualityTier: 5, costTier: 4, latencyTier: 4, contextTier: 5 }),
    provider('local', { capabilities: ['coding'], qualityTier: 2, costTier: 0, latencyTier: 1, local: true, contextTier: 1 }),
  ]);
  const router = new OutcomeAwareProviderRouter({ registry: providers });
  assert.equal(router.select({ mode: 'intelligence', task: { kind: 'architecture', complexity: 0.95 }, requiredCapabilities: ['coding', 'tool-calling'] }).id, 'deep');
  assert.equal(router.select({ mode: 'cost', task: { kind: 'edit', complexity: 0.1 }, requiredCapabilities: ['coding'] }).id, 'local');
  assert.equal(router.select({ mode: 'balance', task: { kind: 'edit', complexity: 0.25 }, requiredCapabilities: ['coding', 'tool-calling'] }).id, 'fast');
});

test('OutcomeAwareProviderRouter accounts for warm prompt cache and measured code retention', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-router-feedback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outcomes = new OutcomeMetricsStore({ file: path.join(root, 'metrics.sqlite') });
  for (let index = 0; index < 8; index += 1) {
    outcomes.record({ providerId: 'steady', taskKind: 'debug', verified: true, accepted: true, retainedLines: 95, generatedLines: 100, correctionCount: 0, costUsd: 0.2, latencyMs: 1_200 });
    outcomes.record({ providerId: 'flashy', taskKind: 'debug', verified: index < 2, accepted: index < 2, retainedLines: 20, generatedLines: 100, correctionCount: 2, costUsd: 0.2, latencyMs: 1_000 });
  }
  const providers = registry([
    provider('steady', { capabilities: ['coding'], qualityTier: 3.5, costTier: 2, latencyTier: 2, cacheIdentity: 'steady-family' }),
    provider('flashy', { capabilities: ['coding'], qualityTier: 5, costTier: 2, latencyTier: 2, cacheIdentity: 'flashy-family' }),
  ]);
  const router = new OutcomeAwareProviderRouter({ registry: providers, outcomeStore: outcomes });
  const ranked = router.rank({ mode: 'balance', task: { kind: 'debug', complexity: 0.6 }, currentCacheIdentity: 'steady-family', promptCacheBytes: 200_000, requiredCapabilities: ['coding'] });
  assert.equal(ranked[0].provider.id, 'steady');
  assert.ok(ranked[0].scoreBreakdown.outcome > ranked[1].scoreBreakdown.outcome);
  assert.ok(ranked[0].scoreBreakdown.cache > ranked[1].scoreBreakdown.cache);
  outcomes.close();
});

test('OutcomeAwareProviderRouter emits an inspectable decision and never routes missing capabilities', () => {
  const providers = registry([
    provider('text', { capabilities: ['text'], qualityTier: 10, costTier: 0, latencyTier: 0 }),
    provider('coder', { capabilities: ['coding', 'tool-calling'], qualityTier: 3, costTier: 2, latencyTier: 2 }),
  ]);
  const router = new OutcomeAwareProviderRouter({ registry: providers });
  const decision = router.decide({ mode: 'balance', task: { kind: 'migration', complexity: 0.8 }, requiredCapabilities: ['coding', 'tool-calling'] });
  assert.equal(decision.provider.id, 'coder');
  assert.equal(decision.ranked.find((entry) => entry.provider.id === 'text').eligible, false);
  assert.match(decision.ranked.find((entry) => entry.provider.id === 'text').reason, /missing capabilities/);
  assert.match(decision.decisionSha256, /^[a-f0-9]{64}$/);
  assert.equal(decision.schema, 'forge.model-route-decision.v2');
});

test('OutcomeMetricsStore deduplicates evidence events and keeps unknown acceptance out of the acceptance rate', () => {
  const outcomes = new OutcomeMetricsStore({ file: ':memory:' });
  const first = outcomes.record({ eventKey: 'verification:task-1:receipt-1', taskId: 'task-1', actor: 'verification-gate', evidenceReceiptSha256: 'a'.repeat(64), providerId: 'deep', taskKind: 'debug', verified: true, accepted: null });
  const duplicate = outcomes.record({ eventKey: 'verification:task-1:receipt-1', taskId: 'task-1', actor: 'verification-gate', evidenceReceiptSha256: 'a'.repeat(64), providerId: 'deep', taskKind: 'debug', verified: true, accepted: null });
  const feedback = outcomes.record({ eventKey: 'feedback:task-1:receipt-2', taskId: 'task-1', actor: 'alice', evidenceReceiptSha256: 'b'.repeat(64), providerId: 'deep', taskKind: 'debug', verified: null, accepted: true, retainedLines: 80, generatedLines: 100, correctionCount: 1 });

  assert.equal(first.recorded, true);
  assert.equal(duplicate.recorded, false);
  assert.equal(feedback.recorded, true);
  const summary = outcomes.summary('deep', 'debug');
  assert.equal(summary.samples, 2);
  assert.equal(summary.verifiedSamples, 1);
  assert.equal(summary.acceptedSamples, 1);
  assert.equal(summary.verifiedRate, 1);
  assert.equal(summary.acceptedRate, 1);
  assert.equal(summary.retentionRate, 0.8);
  outcomes.close();
});

test('OutcomeAwareProviderRouter exposes decision-efficiency observations in shadow mode without changing scores', () => {
  const outcomes = new OutcomeMetricsStore({ file: ':memory:' });
  const providers = registry([
    provider('a', { capabilities: ['coding'], qualityTier: 3, costTier: 1, latencyTier: 1 }),
    provider('b', { capabilities: ['coding'], qualityTier: 3, costTier: 1, latencyTier: 1 }),
  ]);
  const router = new OutcomeAwareProviderRouter({ registry: providers, outcomeStore: outcomes });
  const before = router.rank({ task: { kind: 'debug', complexity: 0.5 }, requiredCapabilities: ['coding'] });
  outcomes.recordDecisionEfficiency({ providerId: 'b', taskKind: 'debug', verifiedValue: 7, tokenYield: 2.5, memoryYield: 0.8, editYield: 0.4, receiptSha256: 'c'.repeat(64) });
  const after = router.rank({ task: { kind: 'debug', complexity: 0.5 }, requiredCapabilities: ['coding'] });
  assert.deepEqual(after.map((entry) => entry.score), before.map((entry) => entry.score));
  assert.equal(after.find((entry) => entry.provider.id === 'b').shadowDecisionEfficiency.samples, 1);
  assert.equal(Object.hasOwn(after.find((entry) => entry.provider.id === 'b').scoreBreakdown, 'decisionEfficiency'), false);
  outcomes.close();
});
