import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

function classifyError(error) {
  const code = String(error?.code ?? '').toUpperCase();
  const message = String(error?.message ?? 'provider failed');
  if (code.includes('RATE') || /\b429\b|rate.?limit/i.test(message)) return { errorClass: 'rate-limit', retryable: true };
  if (code.includes('TIMEOUT') || /timeout|timed out/i.test(message)) return { errorClass: 'timeout', retryable: true };
  if (code.includes('OVERLOAD') || /busy|overload|unavailable|\b5\d\d\b/i.test(message)) return { errorClass: 'provider-unavailable', retryable: true };
  if (code.includes('AUTH') || /invalid api key|unauthori[sz]ed|forbidden/i.test(message)) return { errorClass: 'authentication', retryable: false };
  return { errorClass: error?.retryable === true ? 'retryable-provider-error' : 'provider-error', retryable: error?.retryable === true };
}

function normalizeUsage(usage = {}) {
  const inputTokens = Math.max(0, Number(usage.inputTokens ?? usage.promptTokens ?? 0) || 0);
  const outputTokens = Math.max(0, Number(usage.outputTokens ?? usage.completionTokens ?? 0) || 0);
  const costUsd = Math.max(0, Number(usage.costUsd ?? 0) || 0);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costUsd };
}

function makeReceipt({ requestedProvider, requiredCapabilities, attempts, usage, selectedProviderId }) {
  const base = {
    schema: 'nolane.native-core.provider-attempt-receipt.v1',
    requestedProvider: requestedProvider ?? null,
    requiredCapabilities: [...requiredCapabilities].map(String).sort(),
    selectedProviderId: selectedProviderId ?? null,
    usage,
    attempts,
  };
  return freeze({ ...base, receiptSha256: sha256(JSON.stringify(canonical(base))) });
}

export class ProviderFallbackFabric {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; }

  async invoke({ providers = [], requestedProvider = null, requiredCapabilities = [], request = {} } = {}) {
    const required = [...requiredCapabilities].map(String);
    let candidates = providers.filter((provider) => provider?.enabled !== false && required.every((capability) => (provider.capabilities ?? []).includes(capability)));
    if (requestedProvider) {
      const requested = String(requestedProvider);
      const preferred = candidates.filter((provider) => provider.id === requested || (provider.aliases ?? []).includes(requested));
      if (!preferred.length) throw new Error(`Requested provider or alias is unavailable: ${requested}`);
      const preferredIds = new Set(preferred.map((entry) => entry.id));
      candidates = [...preferred, ...candidates.filter((entry) => !preferredIds.has(entry.id))];
    }
    candidates.sort((a, b) => {
      const aPreferred = requestedProvider && (a.id === requestedProvider || (a.aliases ?? []).includes(requestedProvider)) ? 0 : 1;
      const bPreferred = requestedProvider && (b.id === requestedProvider || (b.aliases ?? []).includes(requestedProvider)) ? 0 : 1;
      return aPreferred - bPreferred || Number(a.priority ?? 100) - Number(b.priority ?? 100) || String(a.id).localeCompare(String(b.id));
    });
    if (!candidates.length) throw new Error(`No provider satisfies capabilities: ${required.join(', ')}`);

    const attempts = [];
    for (const provider of candidates) {
      const startedAt = Number(this.clock());
      try {
        const response = await provider.invoke({ ...request, providerId: provider.id });
        const usage = normalizeUsage(response?.usage);
        attempts.push(freeze({ providerId: provider.id, credentialRefId: provider.credentialRefId ?? null, status: 'succeeded', errorClass: null, startedAt, finishedAt: Number(this.clock()), usage }));
        const attemptReceipt = makeReceipt({ requestedProvider, requiredCapabilities: required, attempts, usage, selectedProviderId: provider.id });
        return freeze({ ...response, providerId: provider.id, attemptReceipt });
      } catch (error) {
        const classification = classifyError(error);
        attempts.push(freeze({ providerId: provider.id, credentialRefId: provider.credentialRefId ?? null, status: 'failed', errorClass: classification.errorClass, startedAt, finishedAt: Number(this.clock()), usage: normalizeUsage() }));
        if (!classification.retryable) {
          error.attemptReceipt = makeReceipt({ requestedProvider, requiredCapabilities: required, attempts, usage: normalizeUsage(), selectedProviderId: null });
          throw error;
        }
      }
    }
    const error = new Error(`All compatible providers failed: ${attempts.map((item) => item.providerId).join(', ')}`);
    error.name = 'RetryableProviderError';
    error.retryable = true;
    error.failures = attempts.map((entry) => ({ providerId: entry.providerId, errorClass: entry.errorClass }));
    error.attemptReceipt = makeReceipt({ requestedProvider, requiredCapabilities: required, attempts, usage: normalizeUsage(), selectedProviderId: null });
    throw error;
  }
}
