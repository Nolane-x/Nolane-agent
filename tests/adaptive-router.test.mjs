import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveProviderRouter } from '../src/providers/adaptive-router.mjs';

function registry(providers) {
  const values = new Map(providers.map((provider) => [provider.id, provider]));
  return {
    list: () => [...values.values()],
    get: (id) => {
      const provider = values.get(id);
      if (!provider) throw new Error(`Unknown provider: ${id}`);
      return provider;
    },
  };
}

function provider(id, profile = {}) {
  return {
    id,
    profile,
    publicView() { return { id, ...profile }; },
    async complete() { return { text: id, toolCalls: [], usage: { totalTokens: 1 } }; },
  };
}

test('AdaptiveProviderRouter deterministically selects the strongest eligible provider and honors constraints', () => {
  const providers = registry([
    provider('local-small', { capabilities: ['coding'], qualityTier: 1, costTier: 0, latencyTier: 1, local: true }),
    provider('cloud-fast', { capabilities: ['coding', 'tool-calling'], qualityTier: 3, costTier: 1, latencyTier: 1, local: false }),
    provider('cloud-deep', { capabilities: ['coding', 'tool-calling', 'long-context'], qualityTier: 5, costTier: 3, latencyTier: 3, local: false }),
  ]);
  const router = new AdaptiveProviderRouter({ registry: providers });

  assert.equal(router.select({ requiredCapabilities: ['coding', 'tool-calling'], maxCostTier: 2 }).id, 'cloud-fast');
  assert.equal(router.select({ requiredCapabilities: ['coding'], localOnly: true }).id, 'local-small');
  assert.equal(router.select({ providerId: 'cloud-deep', localOnly: true }).id, 'cloud-deep', 'explicit override must win');
  assert.deepEqual(
    router.rank({ requiredCapabilities: ['coding'], maxCostTier: 3 }).map((entry) => entry.provider.id),
    ['cloud-deep', 'cloud-fast', 'local-small'],
  );
});

test('AdaptiveProviderRouter opens a bounded cooldown circuit and falls back without hiding the reason', () => {
  let time = 10_000;
  const providers = registry([
    provider('primary', { capabilities: ['coding'], qualityTier: 5, costTier: 1, latencyTier: 1 }),
    provider('fallback', { capabilities: ['coding'], qualityTier: 3, costTier: 1, latencyTier: 1 }),
  ]);
  const router = new AdaptiveProviderRouter({ registry: providers, clock: () => time, failureThreshold: 2, cooldownMs: 1_000 });

  router.recordFailure('primary', new Error('HTTP 503 temporarily unavailable'));
  assert.equal(router.select({ requiredCapabilities: ['coding'] }).id, 'primary');
  router.recordFailure('primary', new Error('HTTP 429 rate limit'));
  const ranked = router.rank({ requiredCapabilities: ['coding'] });
  assert.equal(ranked[0].provider.id, 'fallback');
  assert.equal(ranked.find((entry) => entry.provider.id === 'primary').eligible, false);
  assert.match(ranked.find((entry) => entry.provider.id === 'primary').reason, /cooldown/);

  time += 1_001;
  assert.equal(router.select({ requiredCapabilities: ['coding'] }).id, 'primary');
  router.recordSuccess('primary');
  assert.deepEqual(router.health('primary'), { consecutiveFailures: 0, cooldownUntil: 0, lastError: null });
});

test('AdaptiveProviderRouter rejects impossible capability requests with diagnostics', () => {
  const providers = registry([provider('text-only', { capabilities: ['text'], qualityTier: 2 })]);
  const router = new AdaptiveProviderRouter({ registry: providers });
  assert.throws(
    () => router.select({ requiredCapabilities: ['coding', 'tool-calling'] }),
    /No eligible provider.*text-only.*missing capabilities/i,
  );
});

test('AdaptiveProviderRouter resolves a legacy model-profile key to its registered provider', () => {
  const providers = registry([provider('codex', { capabilities: ['coding'], qualityTier: 2 })]);
  const router = new AdaptiveProviderRouter({ registry: providers });

  assert.equal(router.select({ providerId: 'codex/cli-selected' }).id, 'codex');
});

test('AdaptiveProviderRouter rejects a legacy model-profile key when its provider is not registered', () => {
  const providers = registry([provider('codex', { capabilities: ['coding'], qualityTier: 2 })]);
  const router = new AdaptiveProviderRouter({ registry: providers });

  assert.throws(() => router.select({ providerId: 'missing/model' }), /Unknown provider: missing\/model/);
});

test('AdaptiveProviderRouter does not treat an empty model-profile suffix as a legacy key', () => {
  const providers = registry([provider('codex', { capabilities: ['coding'], qualityTier: 2 })]);
  const router = new AdaptiveProviderRouter({ registry: providers });

  assert.equal(router.select({ providerId: 'codex' }).id, 'codex');
  assert.throws(() => router.select({ providerId: 'codex/' }), /Unknown provider: codex\//);
});

test('AdaptiveProviderRouter excludes installed providers that are not authenticated or healthy', () => {
  const values = [
    provider('logged-out', { capabilities: ['coding'], qualityTier: 9 }),
    provider('ready', { capabilities: ['coding'], qualityTier: 2 }),
  ];
  const detections = new Map([
    ['logged-out', { available: true, authenticated: false, healthy: false }],
    ['ready', { available: true, authenticated: true, healthy: true }],
  ]);
  const providerRegistry = { ...registry(values), detection: (id) => detections.get(id) ?? null };
  const router = new AdaptiveProviderRouter({ registry: providerRegistry });
  assert.equal(router.select({ requiredCapabilities: ['coding'] }).id, 'ready');
  const denied = router.rank({ requiredCapabilities: ['coding'] }).find((entry) => entry.provider.id === 'logged-out');
  assert.equal(denied.eligible, false);
  assert.match(denied.reason, /authentication/i);
  assert.throws(() => router.select({ providerId: 'logged-out' }), /authentication/i);
});
