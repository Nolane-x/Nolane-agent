import { ProviderFallbackFabric } from '../native-core/provider-fallback-fabric.mjs';

export class RetryableProviderError extends Error { constructor(message, options) { super(message, options); this.name = 'RetryableProviderError'; this.retryable = true; } }

export class ProviderRegistry {
  #providers = new Map();
  constructor({ fallbackFabric = new ProviderFallbackFabric() } = {}) {
    if (!fallbackFabric?.invoke) throw new TypeError('ProviderRegistry requires fallback fabric');
    this.fallbackFabric = fallbackFabric;
  }
  register(definition) {
    if (!definition?.id || typeof definition.invoke !== 'function') throw new Error('Provider requires id and invoke');
    const id = String(definition.id); if (this.#providers.has(id)) throw new Error(`Duplicate provider: ${id}`);
    const aliases = Object.freeze([...(definition.aliases ?? [])].map(String));
    for (const provider of this.#providers.values()) {
      if (provider.aliases.some((alias) => aliases.includes(alias)) || aliases.includes(provider.id) || provider.aliases.includes(id)) throw new Error(`Duplicate provider alias: ${id}`);
    }
    this.#providers.set(id, Object.freeze({
      id,
      aliases,
      priority: Number(definition.priority ?? 100),
      capabilities: Object.freeze([...(definition.capabilities ?? [])].map(String)),
      credentialRefId: definition.credentialRefId ? String(definition.credentialRefId) : null,
      invoke: definition.invoke,
      enabled: definition.enabled !== false,
    }));
    return this;
  }
  list() { return Object.freeze([...this.#providers.values()]); }
  resolve(requiredCapabilities = [], requestedProvider = null) {
    const required = [...requiredCapabilities].map(String);
    let candidates = this.list().filter((provider) => provider.enabled && required.every((capability) => provider.capabilities.includes(capability)));
    if (requestedProvider) {
      const preferred = candidates.filter((provider) => provider.id === requestedProvider || provider.aliases.includes(String(requestedProvider)));
      if (!preferred.length) return Object.freeze([]);
      const preferredIds = new Set(preferred.map((entry) => entry.id));
      candidates = [...preferred, ...candidates.filter((entry) => !preferredIds.has(entry.id))];
    }
    return Object.freeze(candidates.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)));
  }
  async invoke({ requestedProvider = null, requiredCapabilities = [], stateCapsule, payload, signal } = {}) {
    try {
      return await this.fallbackFabric.invoke({
        requestedProvider,
        requiredCapabilities,
        providers: this.list(),
        request: { stateCapsule, payload, signal },
      });
    } catch (error) {
      if (error?.retryable === true && !(error instanceof RetryableProviderError)) {
        const wrapped = new RetryableProviderError(error.message, { cause: error });
        wrapped.failures = error.failures ?? error.attemptReceipt?.attempts ?? [];
        wrapped.attemptReceipt = error.attemptReceipt;
        throw wrapped;
      }
      throw error;
    }
  }
}
