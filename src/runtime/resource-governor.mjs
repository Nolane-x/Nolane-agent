const DEFAULT_LIMITS = Object.freeze({
  rssPressureBytes: 700 * 1024 * 1024,
  rssBrownoutBytes: 1_100 * 1024 * 1024,
  eventLoopPressureMs: 80,
  eventLoopBrownoutMs: 250,
  websocketPressureBytes: 2 * 1024 * 1024,
  websocketBrownoutBytes: 8 * 1024 * 1024,
  terminalOutputPressureBytesPerSecond: 2 * 1024 * 1024,
  terminalOutputBrownoutBytesPerSecond: 8 * 1024 * 1024,
  systemAvailablePressureBytes: 3 * 1024 * 1024 * 1024,
  systemAvailableBrownoutBytes: 1536 * 1024 * 1024,
  systemAvailableEmergencyBytes: 800 * 1024 * 1024,
  systemAvailablePressureRatio: 0.20,
  systemAvailableBrownoutRatio: 0.10,
  systemAvailableEmergencyRatio: 0.05,
  maxActiveAgents: 2,
  maxActiveTerminals: 4,
  maxEditorModels: 12,
  maxBrowserSessions: 1,
  maxToolOutputBytes: 1_000_000,
  maxEventHistory: 10_000,
  semanticIndexing: 'incremental',
  backgroundRefresh: false,
});
const RANK = Object.freeze({ normal: 0, pressure: 1, brownout: 2, emergency: 3 });
function finite(value) { const number = Number(value ?? 0); return Number.isFinite(number) && number >= 0 ? number : 0; }
function hasMetric(metrics, key) { return Object.prototype.hasOwnProperty.call(metrics, key) && Number.isFinite(Number(metrics[key])); }
function lowSystemMemory(metrics, absolute, ratio) {
  if (!hasMetric(metrics, 'systemAvailableBytes')) return false;
  const available = finite(metrics.systemAvailableBytes);
  const total = hasMetric(metrics, 'systemTotalBytes') ? finite(metrics.systemTotalBytes) : 0;
  return available <= absolute || (total > 0 && available / total <= ratio);
}

export class ResourceGovernor {
  constructor({ limits = {}, recoverSamples = 3, onTransition = null } = {}) {
    this.limits = Object.freeze({ ...DEFAULT_LIMITS, ...limits });
    this.recoverSamples = Math.max(1, Number(recoverSamples) || 3);
    this.onTransition = typeof onTransition === 'function' ? onTransition : null;
    this.state = 'normal'; this.recoveryCount = 0; this.lastMetrics = Object.freeze({}); this.transitions = 0;
  }

  #desired(metrics) {
    const l = this.limits;
    if (lowSystemMemory(metrics, l.systemAvailableEmergencyBytes, l.systemAvailableEmergencyRatio)) return 'emergency';
    const brownout = lowSystemMemory(metrics, l.systemAvailableBrownoutBytes, l.systemAvailableBrownoutRatio)
      || finite(metrics.rssBytes) >= l.rssBrownoutBytes
      || finite(metrics.eventLoopDelayMs) >= l.eventLoopBrownoutMs
      || finite(metrics.websocketQueueBytes) >= l.websocketBrownoutBytes
      || finite(metrics.terminalOutputBytesPerSecond) >= l.terminalOutputBrownoutBytesPerSecond;
    if (brownout) return 'brownout';
    const pressure = lowSystemMemory(metrics, l.systemAvailablePressureBytes, l.systemAvailablePressureRatio)
      || finite(metrics.rssBytes) >= l.rssPressureBytes
      || finite(metrics.eventLoopDelayMs) >= l.eventLoopPressureMs
      || finite(metrics.websocketQueueBytes) >= l.websocketPressureBytes
      || finite(metrics.terminalOutputBytesPerSecond) >= l.terminalOutputPressureBytesPerSecond;
    return pressure ? 'pressure' : 'normal';
  }

  sample(metrics = {}) {
    const normalized = Object.freeze(Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, finite(value)])));
    this.lastMetrics = normalized; const desired = this.#desired(normalized); const currentRank = RANK[this.state]; const desiredRank = RANK[desired];
    if (desiredRank > currentRank) { this.#transition(desired, normalized, 'threshold-exceeded'); this.recoveryCount = 0; }
    else if (desiredRank < currentRank) { this.recoveryCount += 1; if (this.recoveryCount >= this.recoverSamples) { this.#transition(desired, normalized, 'hysteresis-recovered'); this.recoveryCount = 0; } }
    else this.recoveryCount = 0;
    return this.snapshot();
  }

  #transition(next, metrics, reason) {
    if (next === this.state) return; const previous = this.state; this.state = next; this.transitions += 1;
    this.onTransition?.(Object.freeze({ schema: 'forge.resource.transition.v2', from: previous, to: next, reason, metrics, policy: this.policy(), time: new Date().toISOString() }));
  }

  canAdmit(kind, usage = {}) {
    const policy = this.policy(); let limit; let active;
    if (kind === 'agent') { limit = policy.maxActiveAgents; active = finite(usage.activeAgents); }
    else if (kind === 'terminal') { limit = policy.maxActiveTerminals; active = finite(usage.activeTerminals); }
    else if (kind === 'editor-model') { limit = policy.maxEditorModels; active = finite(usage.openEditorModels); }
    else if (kind === 'browser-session') { limit = policy.maxBrowserSessions; active = finite(usage.activeBrowserSessions); }
    else return Object.freeze({ allowed: false, reason: `unknown-resource-kind:${kind}`, limit: 0, active: 0, state: this.state });
    return Object.freeze({ allowed: active < limit, reason: active < limit ? 'capacity-available' : `${kind}-limit-reached`, limit, active, state: this.state });
  }

  policy() {
    const l = this.limits;
    if (this.state === 'emergency') return Object.freeze({ maxActiveAgents: 0, maxActiveTerminals: 1, maxEditorModels: 1, maxBrowserSessions: 0, maxToolOutputBytes: Math.min(l.maxToolOutputBytes, 64 * 1024), maxEventHistory: Math.min(l.maxEventHistory, 500), terminalFlushIntervalMs: 160, repositoryReindexDelayMs: 5 * 60_000, optionalPreviews: false, backgroundRefresh: false, semanticIndexing: 'suspended', unloadOptionalModules: true, streamCoalesceBytes: 128 * 1024 });
    if (this.state === 'brownout') return Object.freeze({ maxActiveAgents: 0, maxActiveTerminals: 1, maxEditorModels: Math.max(1, Math.floor(l.maxEditorModels / 4)), maxBrowserSessions: 0, maxToolOutputBytes: Math.min(l.maxToolOutputBytes, 128 * 1024), maxEventHistory: Math.min(l.maxEventHistory, 1_000), terminalFlushIntervalMs: 100, repositoryReindexDelayMs: 60_000, optionalPreviews: false, backgroundRefresh: false, semanticIndexing: 'on-demand', unloadOptionalModules: false, streamCoalesceBytes: 64 * 1024 });
    if (this.state === 'pressure') return Object.freeze({ maxActiveAgents: Math.max(1, l.maxActiveAgents - 1), maxActiveTerminals: Math.max(1, l.maxActiveTerminals - 1), maxEditorModels: Math.max(2, Math.floor(l.maxEditorModels / 2)), maxBrowserSessions: Math.min(1, l.maxBrowserSessions), maxToolOutputBytes: Math.min(l.maxToolOutputBytes, 256 * 1024), maxEventHistory: Math.min(l.maxEventHistory, 2_000), terminalFlushIntervalMs: 40, repositoryReindexDelayMs: 10_000, optionalPreviews: true, backgroundRefresh: false, semanticIndexing: 'on-demand', unloadOptionalModules: false, streamCoalesceBytes: 32 * 1024 });
    return Object.freeze({ maxActiveAgents: l.maxActiveAgents, maxActiveTerminals: l.maxActiveTerminals, maxEditorModels: l.maxEditorModels, maxBrowserSessions: l.maxBrowserSessions, maxToolOutputBytes: l.maxToolOutputBytes, maxEventHistory: l.maxEventHistory, terminalFlushIntervalMs: 16, repositoryReindexDelayMs: 0, optionalPreviews: true, backgroundRefresh: l.backgroundRefresh, semanticIndexing: l.semanticIndexing, unloadOptionalModules: false, streamCoalesceBytes: 16 * 1024 });
  }

  snapshot() { return Object.freeze({ schema: 'forge.resource.snapshot.v2', state: this.state, recoveryCount: this.recoveryCount, transitions: this.transitions, metrics: this.lastMetrics, policy: this.policy() }); }
}
