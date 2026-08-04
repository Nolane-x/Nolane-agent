const TRANSIENT = /\b(408|409|425|429|500|502|503|504)\b|timed out|timeout|temporar|rate limit|ECONNRESET|EAI_AGAIN/i;

function tier(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function profileOf(provider, detection = null) {
  const view = typeof provider.publicView === 'function' ? provider.publicView() : {};
  const profile = { ...view, ...(provider.profile ?? {}), ...(detection ?? {}) };
  return {
    capabilities: new Set((profile.capabilities ?? ['text']).map(String)),
    qualityTier: tier(profile.qualityTier, 1),
    costTier: tier(profile.costTier, 1),
    latencyTier: tier(profile.latencyTier, 2),
    local: profile.local === true,
    available: profile.available !== false,
    authenticated: profile.authenticated !== false,
    healthy: profile.healthy !== false,
  };
}

function describe(entries) {
  return entries.map((entry) => `${entry.provider.id}: ${entry.reason}`).join('; ');
}

function resolveExplicitProviderId(registry, providerId) {
  if (typeof providerId !== 'string') return providerId;
  const providerIds = new Set(registry.list().map((provider) => provider.id));
  if (providerIds.has(providerId)) return providerId;
  const separator = providerId.indexOf('/');
  const legacyProviderId = separator > 0 ? providerId.slice(0, separator) : null;
  return legacyProviderId && providerIds.has(legacyProviderId) ? legacyProviderId : providerId;
}

export class AdaptiveProviderRouter {
  #health = new Map();

  constructor({ registry, clock = Date.now, failureThreshold = 2, cooldownMs = 60_000 } = {}) {
    if (!registry?.list || !registry?.get) throw new TypeError('provider registry is required');
    this.registry = registry;
    this.clock = clock;
    this.failureThreshold = Number(failureThreshold);
    this.cooldownMs = Number(cooldownMs);
    if (!Number.isInteger(this.failureThreshold) || this.failureThreshold < 1) throw new TypeError('failureThreshold must be a positive integer');
    if (!Number.isFinite(this.cooldownMs) || this.cooldownMs < 1) throw new TypeError('cooldownMs must be positive');
  }

  health(providerId) {
    const value = this.#health.get(String(providerId));
    return value ? { ...value } : { consecutiveFailures: 0, cooldownUntil: 0, lastError: null };
  }

  recordSuccess(providerId) {
    this.#health.set(String(providerId), { consecutiveFailures: 0, cooldownUntil: 0, lastError: null });
  }

  recordFailure(providerId, error) {
    const id = String(providerId);
    const current = this.health(id);
    const message = String(error?.message ?? error);
    const transient = TRANSIENT.test(message);
    const consecutiveFailures = transient ? current.consecutiveFailures + 1 : 0;
    const cooldownUntil = transient && consecutiveFailures >= this.failureThreshold ? this.clock() + this.cooldownMs : 0;
    this.#health.set(id, { consecutiveFailures, cooldownUntil, lastError: message.slice(0, 500) });
  }

  rank({ providerId = 'auto', requiredCapabilities = [], localOnly = false, maxCostTier = Number.POSITIVE_INFINITY, prefer = [] } = {}) {
    if (providerId && providerId !== 'auto') {
      const provider = this.registry.get(resolveExplicitProviderId(this.registry, providerId));
      const profile = profileOf(provider, this.registry.detection?.(provider.id));
      if (!profile.available) return [{ provider, eligible: false, reason: 'provider unavailable', score: Number.NEGATIVE_INFINITY, profile }];
      if (!profile.authenticated) return [{ provider, eligible: false, reason: 'provider authentication required', score: Number.NEGATIVE_INFINITY, profile }];
      if (!profile.healthy) return [{ provider, eligible: false, reason: 'provider connection is not healthy', score: Number.NEGATIVE_INFINITY, profile }];
      return [{ provider, eligible: true, reason: 'explicit override', score: Number.POSITIVE_INFINITY, profile }];
    }
    const required = new Set(requiredCapabilities.map(String));
    const preferred = new Map(prefer.map((id, index) => [String(id), prefer.length - index]));
    const now = this.clock();
    const entries = this.registry.list().map((provider) => {
      const profile = profileOf(provider, this.registry.detection?.(provider.id));
      const health = this.health(provider.id);
      const missing = [...required].filter((capability) => !profile.capabilities.has(capability));
      let reason = 'eligible';
      let eligible = true;
      if (!profile.available) { eligible = false; reason = 'provider unavailable'; }
      else if (!profile.authenticated) { eligible = false; reason = 'provider authentication required'; }
      else if (!profile.healthy) { eligible = false; reason = 'provider connection is not healthy'; }
      else if (missing.length) { eligible = false; reason = `missing capabilities: ${missing.join(', ')}`; }
      else if (localOnly && !profile.local) { eligible = false; reason = 'not local'; }
      else if (profile.costTier > Number(maxCostTier)) { eligible = false; reason = `cost tier ${profile.costTier} exceeds ${maxCostTier}`; }
      else if (health.cooldownUntil > now) { eligible = false; reason = `cooldown until ${health.cooldownUntil}: ${health.lastError ?? 'recent failures'}`; }
      const score = (profile.qualityTier * 20) - (profile.costTier * 4) - (profile.latencyTier * 2) + ((preferred.get(provider.id) ?? 0) * 100);
      return { provider, eligible, reason, score, profile };
    });
    entries.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.provider.id.localeCompare(b.provider.id));
    return entries;
  }

  select(options = {}) {
    const ranked = this.rank(options);
    const selected = ranked.find((entry) => entry.eligible);
    if (!selected) throw new Error(`No eligible provider. ${describe(ranked)}`);
    return selected.provider;
  }
}
