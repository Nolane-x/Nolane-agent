import { deepFreeze, sha256Receipt } from '../model-profiles/model-profile-schema.mjs';

const DEFAULT_MAX_SAMPLES = 256;
const DEFAULT_BREAKER = Object.freeze({ minimumCalls: 5, failureRate: 0.6, consecutiveFailures: 3, cooldownMs: 60_000 });
const SECRET = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization)/i;

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeText(value, max = 500) {
  return String(value ?? '').replace(/(?:sk|key|token)-[A-Za-z0-9._-]+/gi, '[REDACTED]').slice(0, max);
}

function quantile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1));
  return sorted[index];
}

function cleanMetadata(value) {
  if (Array.isArray(value)) return value.slice(0, 32).map(cleanMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET.test(key)).slice(0, 64).map(([key, child]) => [key, cleanMetadata(child)]));
}

function normalizedObservation(input, clock) {
  const success = input?.success === true;
  const sample = {
    at: String(input?.at ?? clock()),
    success,
    latencyMs: Math.max(0, number(input?.latencyMs, 0)),
    inputTokens: Math.max(0, number(input?.inputTokens, 0)),
    outputTokens: Math.max(0, number(input?.outputTokens, 0)),
    costUsd: Math.max(0, number(input?.costUsd, 0)),
    quality: input?.quality == null ? null : Math.max(0, Math.min(1, number(input.quality, 0))),
    toolSuccess: input?.toolSuccess == null ? null : input.toolSuccess === true,
    errorCode: success ? null : safeText(input?.errorCode ?? 'unknown-error', 120),
    metadata: cleanMetadata(input?.metadata ?? {}),
  };
  return Object.freeze(sample);
}

function emptyState(key) {
  return { key, samples: [], consecutiveFailures: 0, breakerOpenedAtMs: null, breakerReason: null, manualState: null, manualReason: null };
}

export class ModelHealthLedger {
  #states = new Map();
  #clock;
  #now;
  #maxSamples;
  #breaker;

  constructor({ clock = () => new Date().toISOString(), now = () => Date.now(), maxSamples = DEFAULT_MAX_SAMPLES, breaker = {} } = {}) {
    this.#clock = clock;
    this.#now = now;
    this.#maxSamples = Math.max(16, Math.min(4096, Number(maxSamples) || DEFAULT_MAX_SAMPLES));
    this.#breaker = Object.freeze({ ...DEFAULT_BREAKER, ...breaker });
  }

  record(key, observation = {}) {
    const id = String(key ?? '').trim().toLowerCase();
    if (!id) throw new TypeError('Model health key is required');
    const state = this.#states.get(id) ?? emptyState(id);
    const sample = normalizedObservation(observation, this.#clock);
    state.samples.push(sample);
    if (state.samples.length > this.#maxSamples) state.samples.splice(0, state.samples.length - this.#maxSamples);
    state.consecutiveFailures = sample.success ? 0 : state.consecutiveFailures + 1;
    const summary = this.#summarizeState(state);
    if (summary.calls >= this.#breaker.minimumCalls && (summary.failureRate >= this.#breaker.failureRate || state.consecutiveFailures >= this.#breaker.consecutiveFailures)) {
      state.breakerOpenedAtMs = this.#now();
      state.breakerReason = state.consecutiveFailures >= this.#breaker.consecutiveFailures ? 'consecutive-failures' : 'failure-rate';
    }
    this.#states.set(id, state);
    return this.get(id);
  }

  setManualState(key, state, reason = null) {
    const id = String(key ?? '').trim().toLowerCase();
    if (!id) throw new TypeError('Model health key is required');
    if (![null, 'healthy', 'degraded', 'offline', 'maintenance'].includes(state)) throw new TypeError('Invalid manual health state');
    const record = this.#states.get(id) ?? emptyState(id);
    record.manualState = state;
    record.manualReason = reason == null ? null : safeText(reason, 300);
    this.#states.set(id, record);
    return this.get(id);
  }

  resetBreaker(key) {
    const id = String(key ?? '').trim().toLowerCase();
    const state = this.#states.get(id);
    if (!state) return this.get(id);
    state.breakerOpenedAtMs = null;
    state.breakerReason = null;
    state.consecutiveFailures = 0;
    return this.get(id);
  }

  #summarizeState(state) {
    const samples = state.samples;
    const successes = samples.filter((item) => item.success).length;
    const failures = samples.length - successes;
    const reliability = samples.length ? successes / samples.length : null;
    const qualityValues = samples.map((item) => item.quality).filter(Number.isFinite);
    const toolSamples = samples.filter((item) => item.toolSuccess != null);
    const now = this.#now();
    const breakerCooling = Number.isFinite(state.breakerOpenedAtMs) && now - state.breakerOpenedAtMs < this.#breaker.cooldownMs;
    if (Number.isFinite(state.breakerOpenedAtMs) && !breakerCooling) {
      state.breakerOpenedAtMs = null;
      state.breakerReason = null;
      state.consecutiveFailures = 0;
    }
    let status = samples.length ? (reliability >= 0.95 ? 'healthy' : reliability >= 0.75 ? 'degraded' : 'unhealthy') : 'unknown';
    if (breakerCooling) status = 'circuit-open';
    if (state.manualState) status = state.manualState;
    const base = {
      schema: 'nolane.model-health.v1',
      key: state.key,
      status,
      breaker: {
        open: breakerCooling,
        reason: breakerCooling ? state.breakerReason : null,
        openedAtMs: breakerCooling ? state.breakerOpenedAtMs : null,
        cooldownRemainingMs: breakerCooling ? Math.max(0, this.#breaker.cooldownMs - (now - state.breakerOpenedAtMs)) : 0,
      },
      calls: samples.length,
      successes,
      failures,
      failureRate: samples.length ? failures / samples.length : null,
      reliability,
      consecutiveFailures: state.consecutiveFailures,
      latencyMs: {
        p50: quantile(samples.map((item) => item.latencyMs), 0.5),
        p95: quantile(samples.map((item) => item.latencyMs), 0.95),
        max: samples.length ? Math.max(...samples.map((item) => item.latencyMs)) : null,
      },
      tokens: {
        input: samples.reduce((sum, item) => sum + item.inputTokens, 0),
        output: samples.reduce((sum, item) => sum + item.outputTokens, 0),
      },
      spendUsd: samples.reduce((sum, item) => sum + item.costUsd, 0),
      qualityMean: qualityValues.length ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length : null,
      toolSuccessRate: toolSamples.length ? toolSamples.filter((item) => item.toolSuccess).length / toolSamples.length : null,
      lastSeenAt: samples.at(-1)?.at ?? null,
      lastError: [...samples].reverse().find((item) => !item.success)?.errorCode ?? null,
      manualState: state.manualState,
      manualReason: state.manualReason,
    };
    return { ...base, receiptSha256: sha256Receipt(base) };
  }

  get(key) {
    const id = String(key ?? '').trim().toLowerCase();
    const state = this.#states.get(id) ?? emptyState(id);
    return deepFreeze(this.#summarizeState(state));
  }

  list() {
    return deepFreeze([...this.#states.keys()].sort().map((key) => this.get(key)));
  }

  export() {
    const payload = {
      schema: 'nolane.model-health-ledger.v1',
      generatedAt: this.#clock(),
      maxSamples: this.#maxSamples,
      breaker: this.#breaker,
      models: this.list(),
    };
    return deepFreeze({ ...payload, receiptSha256: sha256Receipt(payload) });
  }
}
