import {
  normalizeLiteLlmCatalog,
  normalizeModelsDevCatalog,
  normalizeOpenRouterCatalog,
  normalizePortkeyCatalog,
} from './model-catalog-import.mjs';
import { deepFreeze, sha256Receipt } from './model-profile-schema.mjs';

const DEFAULT_SOURCES = {
  'models.dev': { url: 'https://models.dev/api.json', normalize: normalizeModelsDevCatalog },
  openrouter: { url: 'https://openrouter.ai/api/v1/models', normalize: normalizeOpenRouterCatalog },
  litellm: { url: 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json', normalize: normalizeLiteLlmCatalog },
  portkey: { url: null, normalize: normalizePortkeyCatalog },
};

export class ModelCatalogSyncService {
  #fetch;
  #clock;
  #maxResponseBytes;
  #timeoutMs;

  constructor({ fetch = globalThis.fetch, clock = () => new Date().toISOString(), maxResponseBytes = 32 * 1024 * 1024, timeoutMs = 20_000 } = {}) {
    if (typeof fetch !== 'function') throw new TypeError('ModelCatalogSyncService requires fetch');
    this.#fetch = fetch;
    this.#clock = clock;
    this.#maxResponseBytes = maxResponseBytes;
    this.#timeoutMs = timeoutMs;
  }

  async sync({ sources = ['models.dev', 'openrouter'], sourceUrls = {} } = {}) {
    const observedAt = this.#clock();
    const records = [];
    const succeeded = [];
    const failures = [];
    for (const sourceId of sources) {
      const definition = DEFAULT_SOURCES[sourceId];
      if (!definition) {
        failures.push({ sourceId, code: 'unknown-source', message: `Unknown catalog source: ${sourceId}` });
        continue;
      }
      const url = sourceUrls[sourceId] ?? definition.url;
      if (!url) {
        failures.push({ sourceId, code: 'source-url-required', message: `Source URL is required for ${sourceId}` });
        continue;
      }
      try {
        const payload = await this.#readJson(url);
        const normalized = definition.normalize(payload, { observedAt });
        records.push(...normalized);
        succeeded.push({ sourceId, url, recordCount: normalized.length, observedAt });
      } catch (error) {
        failures.push({ sourceId, code: 'source-sync-failed', message: error.message });
      }
    }
    records.sort((a, b) => `${a.id}:${a.providerFamily}`.localeCompare(`${b.id}:${b.providerFamily}`));
    const payload = { observedAt, records, sources: succeeded, failures };
    return deepFreeze({ ...payload, receiptSha256: sha256Receipt(payload) });
  }

  async #readJson(url) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new TypeError('Catalog source must use http or https');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(parsed.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response?.ok) throw new Error(`HTTP ${response?.status ?? 'unknown'}`);
      const text = await response.text();
      if (Buffer.byteLength(text) > this.#maxResponseBytes) throw new Error(`response exceeds ${this.#maxResponseBytes} bytes`);
      try { return JSON.parse(text); } catch { throw new Error('malformed JSON'); }
    } finally {
      clearTimeout(timer);
    }
  }
}

export const MODEL_CATALOG_SOURCE_DEFINITIONS = deepFreeze(Object.fromEntries(
  Object.entries(DEFAULT_SOURCES).map(([id, value]) => [id, { id, defaultUrl: value.url }]),
));
