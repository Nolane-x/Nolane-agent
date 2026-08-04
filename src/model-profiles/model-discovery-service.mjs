import { deepFreeze, sha256Receipt } from './model-profile-schema.mjs';

function parseParameterSize(value) {
  if (value == null) return null;
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*([BM])/i);
  if (!match) return null;
  return Math.round(Number(match[1]) * (match[2].toUpperCase() === 'B' ? 1e9 : 1e6));
}

function cleanBaseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Discovery base URL must use http or https');
  return url.toString().replace(/\/$/, '');
}

function headersFor(providerFamily, apiKey) {
  if (!apiKey) return { Accept: 'application/json' };
  if (providerFamily === 'anthropic-api') return { Accept: 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  return { Accept: 'application/json', Authorization: `Bearer ${apiKey}` };
}

export class ModelDiscoveryService {
  #fetch;
  #clock;
  #timeoutMs;
  #maxResponseBytes;
  #maxPages;

  constructor({ fetch = globalThis.fetch, clock = () => new Date().toISOString(), timeoutMs = 12_000, maxResponseBytes = 8 * 1024 * 1024, maxPages = 20 } = {}) {
    if (typeof fetch !== 'function') throw new TypeError('ModelDiscoveryService requires fetch');
    this.#fetch = fetch;
    this.#clock = clock;
    this.#timeoutMs = timeoutMs;
    this.#maxResponseBytes = maxResponseBytes;
    this.#maxPages = maxPages;
  }

  async #json(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(url, { ...options, signal: controller.signal });
      if (!response?.ok) throw new Error(`Model discovery failed with HTTP ${response?.status ?? 'unknown'}`);
      const text = await response.text();
      if (Buffer.byteLength(text) > this.#maxResponseBytes) throw new Error(`Model discovery response exceeds ${this.#maxResponseBytes} bytes`);
      try { return JSON.parse(text); } catch { throw new Error('Model discovery returned malformed JSON'); }
    } finally {
      clearTimeout(timer);
    }
  }

  async discover({ providerFamily, baseUrl, apiKey = null }) {
    const observedAt = this.#clock();
    const normalizedBase = cleanBaseUrl(baseUrl);
    const headers = headersFor(providerFamily, apiKey);
    let models;
    if (providerFamily === 'anthropic-api') models = await this.#anthropic(normalizedBase, headers, observedAt);
    else if (providerFamily === 'google-api' || providerFamily === 'gemini-api') models = await this.#gemini(normalizedBase, apiKey, observedAt);
    else if (providerFamily === 'ollama') models = await this.#ollama(normalizedBase, observedAt);
    else if (providerFamily === 'lm-studio') models = await this.#lmStudio(normalizedBase, observedAt);
    else models = await this.#openAiCompatible(normalizedBase, headers, providerFamily, observedAt);
    const payload = { providerFamily, baseUrl: normalizedBase, observedAt, models };
    return deepFreeze({ ...payload, receiptSha256: sha256Receipt(payload) });
  }

  async #openAiCompatible(baseUrl, headers, providerFamily, observedAt) {
    const payload = await this.#json(`${baseUrl}/v1/models`, { headers });
    return (payload.data ?? []).filter((model) => model?.id).map((model) => ({
      id: this.#canonicalizeProviderId(providerFamily, model.id),
      providerFamily,
      providerModelId: model.id,
      identity: { publisher: model.owned_by ?? null },
      source: { type: 'provider-api', providerId: providerFamily, observedAt },
    }));
  }

  async #anthropic(baseUrl, headers, observedAt) {
    const models = [];
    let afterId = null;
    for (let page = 0; page < this.#maxPages; page += 1) {
      const url = new URL(`${baseUrl}/v1/models`);
      if (afterId) url.searchParams.set('after_id', afterId);
      const payload = await this.#json(url.toString(), { headers });
      for (const model of payload.data ?? []) {
        if (!model?.id) continue;
        models.push({
          id: `anthropic/${String(model.id).toLowerCase()}`,
          providerFamily: 'anthropic-api', providerModelId: model.id,
          identity: { displayName: model.display_name ?? null, releaseDate: model.created_at?.slice?.(0, 10) ?? null },
          source: { type: 'provider-api', providerId: 'anthropic-api', observedAt },
        });
      }
      if (!payload.has_more || !payload.last_id) break;
      afterId = payload.last_id;
    }
    return models;
  }

  async #gemini(baseUrl, apiKey, observedAt) {
    const models = [];
    let pageToken = null;
    for (let page = 0; page < this.#maxPages; page += 1) {
      const url = new URL(`${baseUrl}/v1beta/models`);
      if (apiKey) url.searchParams.set('key', apiKey);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const payload = await this.#json(url.toString(), { headers: { Accept: 'application/json' } });
      for (const model of payload.models ?? []) {
        const providerId = String(model.name ?? '').replace(/^models\//, '');
        if (!providerId) continue;
        const methods = new Set(model.supportedGenerationMethods ?? []);
        models.push({
          id: `google/${providerId.toLowerCase()}`,
          providerFamily: 'google-api', providerModelId: providerId,
          identity: { displayName: model.displayName ?? null },
          context: { contextWindow: model.inputTokenLimit ?? null, maxInputTokens: model.inputTokenLimit ?? null, maxOutputTokens: model.outputTokenLimit ?? null },
          capabilities: {
            streaming: methods.has('streamGenerateContent') ? true : methods.has('generateContent') ? true : null,
            embeddings: methods.has('embedContent') || methods.has('batchEmbedContents') ? true : null,
          },
          source: { type: 'provider-api', providerId: 'google-api', observedAt },
        });
      }
      if (!payload.nextPageToken) break;
      pageToken = payload.nextPageToken;
    }
    return models;
  }

  async #ollama(baseUrl, observedAt) {
    const payload = await this.#json(`${baseUrl}/api/tags`, { headers: { Accept: 'application/json' } });
    return (payload.models ?? []).filter((model) => model?.name).map((model) => ({
      id: `ollama/${String(model.name).toLowerCase()}`,
      providerFamily: 'ollama', providerModelId: model.name,
      identity: { family: model.details?.family ?? null },
      architecture: {
        totalParameters: parseParameterSize(model.details?.parameter_size),
        format: model.details?.format ?? null,
        quantization: model.details?.quantization_level ?? null,
        runtime: 'ollama',
      },
      deployment: { local: true, remote: false, selfHostable: true, endpointType: 'ollama' },
      localRequirements: { artifactSizeBytes: model.size ?? null },
      source: { type: 'local-runtime', providerId: 'ollama', observedAt },
    }));
  }

  async #lmStudio(baseUrl, observedAt) {
    let payload;
    try { payload = await this.#json(`${baseUrl}/api/v1/models`, { headers: { Accept: 'application/json' } }); }
    catch { payload = await this.#json(`${baseUrl}/v1/models`, { headers: { Accept: 'application/json' } }); }
    return (payload.data ?? payload.models ?? []).filter((model) => model?.id).map((model) => ({
      id: `lm-studio/${String(model.id).toLowerCase()}`,
      providerFamily: 'lm-studio', providerModelId: model.id,
      architecture: {
        type: model.arch ?? model.architecture ?? null,
        totalParameters: parseParameterSize(model.parameter_size ?? model.params),
        quantization: model.quantization ?? null,
        runtime: /mlx/i.test(model.id) ? 'mlx' : 'lm-studio',
      },
      deployment: { local: true, remote: false, selfHostable: true, endpointType: 'lm-studio' },
      source: { type: 'local-runtime', providerId: 'lm-studio', observedAt },
    }));
  }

  #canonicalizeProviderId(providerFamily, id) {
    const clean = String(id).toLowerCase();
    if (clean.includes('/')) return clean;
    const publisher = {
      'openai-api': 'openai', 'deepseek-api': 'deepseek', 'mistral-api': 'mistralai',
      'moonshot-api': 'moonshotai', 'cohere-api': 'cohere', 'xai-api': 'x-ai',
    }[providerFamily];
    return publisher ? `${publisher}/${clean}` : clean;
  }
}
