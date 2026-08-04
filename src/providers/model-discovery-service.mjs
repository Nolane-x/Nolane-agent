const redact = (value) => String(value ?? '').replace(/(?:sk|key|token)-[A-Za-z0-9._-]+/gi, '[REDACTED]').slice(0, 300);
function endpoint({ kind, baseUrl }) {
  const base = String(baseUrl ?? '').replace(/\/$/, '');
  if (kind === 'gemini-generate-content') return `${base}/models`;
  if (kind === 'ollama') return `${base.replace(/\/v1$/, '')}/api/tags`;
  return `${base}/models`;
}
export function normalizeDiscoveredModels(payload, { providerId, kind = '' } = {}) {
  const list = payload?.data ?? payload?.models ?? payload?.items ?? [];
  return list.map((item) => {
    const rawName = item.id ?? item.name ?? item.model ?? item.baseModelId;
    const id = String(rawName ?? '').replace(/^models\//, '');
    const input = item.input_modalities ?? item.inputModalities ?? (Array.isArray(item.supportedGenerationMethods) ? ['text'] : undefined);
    const output = item.output_modalities ?? item.outputModalities ?? ['text'];
    const local = item.details ? { parameterSize: item.details.parameter_size ?? null, quantization: item.details.quantization_level ?? null, format: item.details.format ?? null, bytes: item.size ?? null } : {};
    return { providerId, id, modelId: id, displayName: item.displayName ?? item.display_name ?? id, owner: item.owned_by ?? item.owner ?? null, created: item.created ?? item.modified_at ?? null, aliases: item.aliases ?? [], contextLength: item.context_length ?? item.inputTokenLimit ?? item.contextWindow ?? null, outputTokenLimit: item.outputTokenLimit ?? item.max_output_tokens ?? null, inputModalities: input ?? ['text'], outputModalities: output, local, metadata: { version: item.version ?? null, description: item.description ?? null, supportedActions: item.supportedActions ?? item.supportedGenerationMethods ?? [] }, kind };
  }).filter((item) => item.id);
}
export class ModelDiscoveryService {
  constructor({ fetchImpl = fetch, clock = () => new Date().toISOString() } = {}) { this.fetchImpl = fetchImpl; this.clock = clock; this.lastKnown = new Map(); }
  async discover({ providerId, kind, baseUrl, headers = {}, apiKey = null } = {}) {
    if (!providerId || !kind || !baseUrl) throw new TypeError('providerId, kind, and baseUrl are required');
    const url = endpoint({ kind, baseUrl }); const requestHeaders = { accept: 'application/json', ...headers };
    if (apiKey && kind === 'gemini-generate-content') { const parsed = new URL(url); parsed.searchParams.set('key', apiKey); return this.#fetch(providerId, kind, parsed.toString(), requestHeaders); }
    if (apiKey) requestHeaders.authorization = `Bearer ${apiKey}`;
    return this.#fetch(providerId, kind, url, requestHeaders);
  }
  async #fetch(providerId, kind, url, headers) {
    try {
      const response = await this.fetchImpl(url, { method: 'GET', headers });
      if (!response.ok) throw new Error(`Model discovery failed with HTTP ${response.status}`);
      const models = normalizeDiscoveredModels(await response.json(), { providerId, kind });
      const result = Object.freeze({ providerId, kind, discoveredAt: this.clock(), source: url.replace(/([?&]key=)[^&]+/i, '$1[REDACTED]'), models: Object.freeze(models) });
      this.lastKnown.set(providerId, result); return result;
    } catch (error) {
      const previous = this.lastKnown.get(providerId);
      if (previous) return Object.freeze({ ...previous, stale: true, error: redact(error?.message ?? error) });
      throw Object.assign(new Error(redact(error?.message ?? error)), { code: 'model_discovery_failed' });
    }
  }
}
