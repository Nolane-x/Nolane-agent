import os from 'node:os';
import path from 'node:path';

import { resolveRuntimeProfile } from './runtime/runtime-profile-service.mjs';

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function boundedInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER, label = 'value' } = {}) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new TypeError(`${label} must be an integer between ${min} and ${max}`);
  }
  return number;
}

export function loadConfig(overrides = {}) {
  const host = String(overrides.host ?? process.env.NOLANE_AGENT_HOST ?? process.env.FORGE_STUDIO_HOST ?? '127.0.0.1');
  if (!LOOPBACK.has(host) && overrides.allowRemote !== true) {
    throw new Error('Nolane Agent binds to loopback only unless allowRemote is explicitly enabled');
  }

  const requestedProfile = overrides.performance?.profile ?? process.env.NOLANE_AGENT_PERFORMANCE_PROFILE ?? process.env.FORGE_STUDIO_PERFORMANCE_PROFILE ?? 'auto';
  const runtimeProfile = resolveRuntimeProfile({ requested: requestedProfile, totalMemoryBytes: overrides.totalMemoryBytes ?? os.totalmem() });
  const profilePerformance = runtimeProfile.performance;

  const config = {
    host,
    port: boundedInteger(overrides.port ?? process.env.NOLANE_AGENT_PORT ?? process.env.FORGE_STUDIO_PORT, 0, { min: 0, max: 65535, label: 'port' }),
    dataDir: path.resolve(String(overrides.dataDir ?? process.env.NOLANE_AGENT_DATA_DIR ?? process.env.FORGE_STUDIO_DATA_DIR ?? path.join(os.homedir(), '.nolane-agent'))),
    workspaceRoot: path.resolve(String(overrides.workspaceRoot ?? process.env.NOLANE_AGENT_WORKSPACE ?? process.env.FORGE_STUDIO_WORKSPACE ?? process.cwd())),
    forgeOsRoot: path.resolve(String(overrides.forgeOsRoot ?? path.join(process.cwd(), 'vendor', 'forge-os'))),
    authToken: overrides.authToken ?? process.env.NOLANE_AGENT_TOKEN ?? process.env.FORGE_STUDIO_TOKEN ?? null,
    budgets: {
      maxTurns: boundedInteger(overrides.budgets?.maxTurns, 24, { min: 1, max: 500, label: 'maxTurns' }),
      maxToolCalls: boundedInteger(overrides.budgets?.maxToolCalls, 64, { min: 0, max: 2_000, label: 'maxToolCalls' }),
      maxElapsedMs: boundedInteger(overrides.budgets?.maxElapsedMs, 20 * 60_000, { min: 1_000, max: 24 * 60 * 60_000, label: 'maxElapsedMs' }),
      maxEstimatedTokens: boundedInteger(overrides.budgets?.maxEstimatedTokens, 240_000, { min: 1_000, max: 20_000_000, label: 'maxEstimatedTokens' }),
    },
    performance: {
      requestedProfile: runtimeProfile.requested,
      profile: runtimeProfile.resolved,
      profileReason: runtimeProfile.reason,
      maxActiveAgents: boundedInteger(overrides.performance?.maxActiveAgents, profilePerformance.maxActiveAgents, { min: 1, max: 16, label: 'maxActiveAgents' }),
      maxVisibleTerminals: boundedInteger(overrides.performance?.maxVisibleTerminals, profilePerformance.maxVisibleTerminals, { min: 1, max: 16, label: 'maxVisibleTerminals' }),
      maxEditorModels: boundedInteger(overrides.performance?.maxEditorModels, profilePerformance.maxEditorModels, { min: 1, max: 64, label: 'maxEditorModels' }),
      maxTerminalFrameBytes: boundedInteger(overrides.performance?.maxTerminalFrameBytes, profilePerformance.maxTerminalFrameBytes, { min: 4096, max: 16 * 1024 * 1024, label: 'maxTerminalFrameBytes' }),
      maxTerminalQueueBytes: boundedInteger(overrides.performance?.maxTerminalQueueBytes, profilePerformance.maxTerminalQueueBytes, { min: 4096, max: 64 * 1024 * 1024, label: 'maxTerminalQueueBytes' }),
      maxEventHistory: boundedInteger(overrides.performance?.maxEventHistory, profilePerformance.maxEventHistory, { min: 100, max: 1_000_000, label: 'maxEventHistory' }),
      maxToolOutputBytes: boundedInteger(overrides.performance?.maxToolOutputBytes, profilePerformance.maxToolOutputBytes, { min: 1_024, max: 50_000_000, label: 'maxToolOutputBytes' }),
      maxBrowserSessions: boundedInteger(overrides.performance?.maxBrowserSessions, profilePerformance.maxBrowserSessions, { min: 0, max: 16, label: 'maxBrowserSessions' }),
      semanticIndexing: runtimeProfile.features.semanticIndexing,
      backgroundRefresh: runtimeProfile.features.backgroundRefresh,
      reducedEffects: runtimeProfile.features.reducedEffects,
    },
    allowedCommands: [...new Set((overrides.allowedCommands ?? [
      'git', 'node', 'npm', 'npx', 'python', 'python3', 'pip', 'pytest',
      'codex', 'claude', 'gemini', 'opencode', 'nolane_native',
    ]).map(String))],
    allowRemote: overrides.allowRemote === true,
  };
  return deepFreeze(config);
}

export { deepFreeze };
