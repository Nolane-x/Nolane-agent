import os from 'node:os';

const GiB = 1024 ** 3;
const PROFILE_NAMES = Object.freeze(['auto', 'lite', 'balanced', 'performance']);
const PROFILES = Object.freeze({
  lite: Object.freeze({
    performance: Object.freeze({
      maxActiveAgents: 1,
      maxVisibleTerminals: 2,
      maxEditorModels: 4,
      maxTerminalFrameBytes: 256 * 1024,
      maxTerminalQueueBytes: 512 * 1024,
      maxEventHistory: 2_000,
      maxToolOutputBytes: 256 * 1024,
      maxBrowserSessions: 0,
    }),
    features: Object.freeze({ semanticIndexing: 'on-demand', backgroundRefresh: false, reducedEffects: true }),
  }),
  balanced: Object.freeze({
    performance: Object.freeze({
      maxActiveAgents: 2,
      maxVisibleTerminals: 4,
      maxEditorModels: 8,
      maxTerminalFrameBytes: 512 * 1024,
      maxTerminalQueueBytes: 1024 * 1024,
      maxEventHistory: 5_000,
      maxToolOutputBytes: 512 * 1024,
      maxBrowserSessions: 1,
    }),
    features: Object.freeze({ semanticIndexing: 'incremental', backgroundRefresh: false, reducedEffects: false }),
  }),
  performance: Object.freeze({
    performance: Object.freeze({
      maxActiveAgents: 4,
      maxVisibleTerminals: 6,
      maxEditorModels: 16,
      maxTerminalFrameBytes: 1024 * 1024,
      maxTerminalQueueBytes: 2 * 1024 * 1024,
      maxEventHistory: 10_000,
      maxToolOutputBytes: 1_000_000,
      maxBrowserSessions: 2,
    }),
    features: Object.freeze({ semanticIndexing: 'background', backgroundRefresh: true, reducedEffects: false }),
  }),
});

function finiteBytes(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function resolveRuntimeProfile({ requested = 'auto', totalMemoryBytes = os.totalmem() } = {}) {
  const normalized = String(requested ?? 'auto').trim().toLowerCase();
  if (!PROFILE_NAMES.includes(normalized)) throw new TypeError(`profile must be one of: ${PROFILE_NAMES.join(', ')}`);
  const total = finiteBytes(totalMemoryBytes, os.totalmem());
  const resolved = normalized === 'auto'
    ? (total <= 12 * GiB ? 'lite' : total <= 24 * GiB ? 'balanced' : 'performance')
    : normalized;
  const selected = PROFILES[resolved];
  return Object.freeze({
    schema: 'forge.runtime-profile.v1',
    requested: normalized,
    resolved,
    totalMemoryBytes: total,
    reason: normalized === 'auto' ? `auto-total-memory:${total}` : 'explicit-profile',
    performance: selected.performance,
    features: selected.features,
  });
}

export { PROFILE_NAMES, PROFILES };
