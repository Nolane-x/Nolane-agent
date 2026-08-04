import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRuntimeProfile } from '../src/runtime/runtime-profile-service.mjs';
import { loadConfig } from '../src/config.mjs';

const GiB = 1024 ** 3;

test('auto profile selects lite defaults for an 8 GiB machine', () => {
  const profile = resolveRuntimeProfile({ requested: 'auto', totalMemoryBytes: 8 * GiB });
  assert.equal(profile.resolved, 'lite');
  assert.deepEqual(profile.performance, {
    maxActiveAgents: 1,
    maxVisibleTerminals: 2,
    maxEditorModels: 4,
    maxTerminalFrameBytes: 256 * 1024,
    maxTerminalQueueBytes: 512 * 1024,
    maxEventHistory: 2_000,
    maxToolOutputBytes: 256 * 1024,
    maxBrowserSessions: 0,
  });
  assert.equal(profile.features.semanticIndexing, 'on-demand');
  assert.equal(profile.features.backgroundRefresh, false);
  assert.equal(profile.features.reducedEffects, true);
});

test('auto profile scales through balanced and performance without changing explicit selection', () => {
  assert.equal(resolveRuntimeProfile({ requested: 'auto', totalMemoryBytes: 16 * GiB }).resolved, 'balanced');
  assert.equal(resolveRuntimeProfile({ requested: 'auto', totalMemoryBytes: 32 * GiB }).resolved, 'performance');
  assert.equal(resolveRuntimeProfile({ requested: 'lite', totalMemoryBytes: 64 * GiB }).resolved, 'lite');
});

test('loadConfig applies profile defaults and preserves explicit numeric overrides', () => {
  const config = loadConfig({
    totalMemoryBytes: 8 * GiB,
    performance: { profile: 'auto', maxActiveAgents: 3, maxToolOutputBytes: 300_000 },
  });
  assert.equal(config.performance.profile, 'lite');
  assert.equal(config.performance.requestedProfile, 'auto');
  assert.equal(config.performance.maxActiveAgents, 3);
  assert.equal(config.performance.maxVisibleTerminals, 2);
  assert.equal(config.performance.maxToolOutputBytes, 300_000);
  assert.equal(config.performance.semanticIndexing, 'on-demand');
});

test('runtime profile rejects unknown names', () => {
  assert.throws(() => resolveRuntimeProfile({ requested: 'turbo', totalMemoryBytes: 8 * GiB }), /profile must be one of/);
});

import { SystemResourceSampler } from '../src/runtime/system-resource-sampler.mjs';

test('system resource sampler reports process and machine availability from injectable sources', () => {
  const sampler = new SystemResourceSampler({
    osModule: { totalmem: () => 8_000, freemem: () => 2_000, loadavg: () => [1.5, 0, 0] },
    memoryUsage: () => ({ rss: 500, heapUsed: 300, external: 20 }),
    clock: () => 1234,
  });
  assert.deepEqual(sampler.sample({ eventLoopDelayMs: 7 }), {
    sampledAtMs: 1234,
    rssBytes: 500,
    heapUsedBytes: 300,
    externalBytes: 20,
    systemTotalBytes: 8_000,
    systemAvailableBytes: 2_000,
    systemAvailableRatio: 0.25,
    loadAverage1m: 1.5,
    eventLoopDelayMs: 7,
  });
});
