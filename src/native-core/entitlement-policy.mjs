const DEFAULT_CAPABILITIES = Object.freeze({
  community: Object.freeze([
    'agent:local',
    'browser:approved-local',
    'execution:local',
    'memory:local',
    'plugins:local-signed',
    'providers:bring-your-own-key',
    'sessions:unlimited-local',
  ]),
  pro: Object.freeze([
    'agent:local',
    'browser:approved-local',
    'execution:local',
    'memory:local',
    'plugins:local-signed',
    'provider:hosted',
    'providers:bring-your-own-key',
    'sessions:unlimited-local',
    'support:priority',
  ]),
});

const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

export class EntitlementPolicy {
  constructor({ tier = 'community', capabilities = DEFAULT_CAPABILITIES } = {}) {
    if (!capabilities || typeof capabilities !== 'object') throw new TypeError('capabilities must be an object');
    if (!Object.hasOwn(capabilities, tier)) throw new Error(`Unknown entitlement tier: ${tier}`);
    this.tier = String(tier);
    this.capabilities = new Set((capabilities[this.tier] ?? []).map(String));
  }

  allows(capability) {
    return this.capabilities.has(String(capability));
  }

  require(capability) {
    const normalized = String(capability);
    if (!this.allows(normalized)) throw Object.assign(new Error(`Entitlement denied: ${normalized}`), { code: 'ENTITLEMENT_DENIED', capability: normalized, tier: this.tier });
    return true;
  }

  snapshot() {
    return freeze({
      schema: 'nolane.entitlement-policy.v1',
      owner: 'Nolane Agent',
      tier: this.tier,
      capabilities: [...this.capabilities].sort(),
      secretFields: [],
      upstreamBillingCopied: false,
    });
  }
}
