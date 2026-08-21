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

function familyFor({ providerFamily = null, providerId = null, kind = null } = {}) {
  if (providerFamily) return String(providerFamily);
  const byKind = {
    'openai-responses': 'openai-api',
    'anthropic-messages': 'anthropic-api',
    'gemini-generate-content': 'gemini-api',
    'openai-compatible': String(providerId ?? 'openai-compatible'),
  };
  return byKind[String(kind)] ?? String(providerId ?? 'openai-compatible');
}

function endpoint(baseUrl, suffix) {
  const base = new URL(baseUrl);
  const suffixUrl = new URL(suffix, 'http://discovery.invalid');
  const basePath = base.pathname.replace(/\/+$/, '');
  const suffixPath = suffixUrl.pathname;
  const knownPrefix = ['/v1beta', '/v1'].find((prefix) => suffixPath.startsWith(`${prefix}/`) && basePath.endsWith(prefix));
  base.pathname = `${basePath}${knownPrefix ? suffixPath.slice(knownPrefix.length) : suffixPath}`;
  return base.toString();
}

const controls = (levels) => Object.freeze({ supported: true, controllable: true, levels: Object.freeze(levels) });
const OPENAI_REASONING_CONTROLS = Object.freeze({
  'gpt-5': controls(['minimal', 'low', 'medium', 'high']),
  'gpt-5.1': controls(['none', 'low', 'medium', 'high']),
  'gpt-5.2': controls(['none', 'low', 'medium', 'high', 'xhigh']),
  'gpt-5.2-codex': controls(['low', 'medium', 'high', 'xhigh']),
  'gpt-5.3-codex': controls(['low', 'medium', 'high', 'xhigh']),
});

function cloneControls(value) {
  return value ? { supported: value.supported, controllable: value.controllable, levels: [...value.levels] } : undefined;
}

function anthropicEffortControls(capability) {
  const order = ['low', 'medium', 'high', 'xhigh', 'max'];
  const levels = order.filter((level) => capability?.[level]?.supported === true);
  return levels.length ? controls(levels) : undefined;
}

function geminiReasoningControls(providerModelId) {
  const id = String(providerModelId ?? '').trim().toLowerCase();
  if (/^gemini-3\.1-pro(?:[-:].*)?$/.test(id) || /^gemini-3\.7-flash(?:[-:].*)?$/.test(id)) return controls(['low', 'medium', 'high']);
  if (/^gemini-3\.(?:1|5)-flash-lite(?:[-:].*)?$/.test(id) || /^gemini-3\.(?:5|6)-flash(?:[-:].*)?$/.test(id) || /^gemini-3-flash(?:[-:].*)?$/.test(id)) return controls(['minimal', 'low', 'medium', 'high']);
  return undefined;
}

function knownReasoningControls(providerFamily, providerModelId) {
  const family = String(providerFamily ?? '').toLowerCase();
  const id = String(providerModelId ?? '').trim().toLowerCase();
  if (family === 'openai-api') {
    if (/^gpt-5\.6(?:-(?:sol|terra|luna))?$/.test(id)) return controls(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
    return cloneControls(OPENAI_REASONING_CONTROLS[id]);
  }
  if (family === 'gemini-api' || family === 'google-api') return geminiReasoningControls(id);
  return undefined;
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

  async discover({ providerFamily = null, providerId = null, kind = null, baseUrl, apiKey = null, headers = {} }) {
    const resolvedFamily = familyFor({ providerFamily, providerId, kind });
    const observedAt = this.#clock();
    const normalizedBase = cleanBaseUrl(baseUrl);
    const resolvedHeaders = { ...headersFor(resolvedFamily, apiKey), ...headers };
    let models;
    if (resolvedFamily === 'anthropic-api') models = await this.#anthropic(normalizedBase, resolvedHeaders, observedAt);
    else if (resolvedFamily === 'google-api' || resolvedFamily === 'gemini-api') models = await this.#gemini(normalizedBase, apiKey, resolvedHeaders, observedAt);
    else if (resolvedFamily === 'ollama') models = await this.#ollama(normalizedBase, observedAt);
    else if (resolvedFamily === 'lm-studio') models = await this.#lmStudio(normalizedBase, observedAt);
    else models = await this.#openAiCompatible(normalizedBase, resolvedHeaders, resolvedFamily, observedAt);
    const payload = { providerFamily: resolvedFamily, providerId: providerId ? String(providerId) : null, kind: kind ? String(kind) : null, baseUrl: normalizedBase, observedAt, models };
    return deepFreeze({ ...payload, receiptSha256: sha256Receipt(payload) });
  }

  async #openAiCompatible(baseUrl, headers, providerFamily, observedAt) {
    const payload = await this.#json(endpoint(baseUrl, '/v1/models'), { headers });
    return (payload.data ?? []).filter((model) => model?.id).map((model) => {
      const reasoning = knownReasoningControls(providerFamily, model.id);
      return {
        id: this.#canonicalizeProviderId(providerFamily, model.id),
        providerFamily,
        providerModelId: model.id,
        identity: { publisher: model.owned_by ?? null },
        ...(reasoning ? { reasoning } : {}),
        source: { type: 'provider-api', providerId: providerFamily, observedAt },
      };
    });
  }

  async #anthropic(baseUrl, headers, observedAt) {
    const models = [];
    let afterId = null;
    for (let page = 0; page < this.#maxPages; page += 1) {
      const url = new URL(endpoint(baseUrl, '/v1/models'));
      if (afterId) url.searchParams.set('after_id', afterId);
      const payload = await this.#json(url.toString(), { headers });
      for (const model of payload.data ?? []) {
        if (!model?.id) continue;
        const reasoning = anthropicEffortControls(model.capabilities?.effort);
        models.push({
          id: `anthropic/${String(model.id).toLowerCase()}`,
          providerFamily: 'anthropic-api', providerModelId: model.id,
          identity: { displayName: model.display_name ?? null, releaseDate: model.created_at?.slice?.(0, 10) ?? null },
          ...(reasoning ? { reasoning } : {}),
          source: { type: 'provider-api', providerId: 'anthropic-api', observedAt },
        });
      }
      if (!payload.has_more || !payload.last_id) break;
      afterId = payload.last_id;
    }
    return models;
  }

  async #gemini(baseUrl, apiKey, headers, observedAt) {
    const models = [];
    let pageToken = null;
    for (let page = 0; page < this.#maxPages; page += 1) {
      const url = new URL(endpoint(baseUrl, '/v1beta/models'));
      if (apiKey) url.searchParams.set('key', apiKey);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const payload = await this.#json(url.toString(), { headers: { Accept: 'application/json', ...headers } });
      for (const model of payload.models ?? []) {
        const providerId = String(model.name ?? '').replace(/^models\//, '');
        if (!providerId) continue;
        const methods = new Set(model.supportedGenerationMethods ?? []);
        const reasoning = knownReasoningControls('gemini-api', providerId);
        models.push({
          id: `google/${providerId.toLowerCase()}`,
          providerFamily: 'google-api', providerModelId: providerId,
          identity: { displayName: model.displayName ?? null },
          context: { contextWindow: model.inputTokenLimit ?? null, maxInputTokens: model.inputTokenLimit ?? null, maxOutputTokens: model.outputTokenLimit ?? null },
          capabilities: {
            streaming: methods.has('streamGenerateContent') ? true : methods.has('generateContent') ? true : null,
            embeddings: methods.has('embedContent') || methods.has('batchEmbedContents') ? true : null,
          },
          ...(reasoning ? { reasoning } : {}),
          source: { type: 'provider-api', providerId: 'google-api', observedAt },
        });
      }
      if (!payload.nextPageToken) break;
      pageToken = payload.nextPageToken;
    }
    return models;
  }

  async #ollama(baseUrl, observedAt) {
    const payload = await this.#json(endpoint(baseUrl, '/api/tags'), { headers: { Accept: 'application/json' } });
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
    try { payload = await this.#json(endpoint(baseUrl, '/api/v1/models'), { headers: { Accept: 'application/json' } }); }
    catch { payload = await this.#json(endpoint(baseUrl, '/v1/models'), { headers: { Accept: 'application/json' } }); }
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
