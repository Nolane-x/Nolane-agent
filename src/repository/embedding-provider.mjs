import { createHash } from 'node:crypto';

function tokens(value) {
  return String(value ?? '').toLowerCase().match(/[\p{L}\p{N}_$.-]{2,}/gu) ?? [];
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function frozen(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozen));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, frozen(child)])));
}

function descriptor(provider, available) {
  return frozen({
    id: String(provider.id),
    kind: String(provider.kind ?? (provider.degraded ? 'fallback' : 'neural')),
    dimensions: Math.max(1, Number(provider.dimensions) || 1),
    degraded: provider.degraded === true,
    modelSha256: provider.modelSha256 == null ? null : String(provider.modelSha256),
    available: Boolean(available),
  });
}

function validateProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new TypeError('embedding provider is required');
  const id = String(provider.id ?? '').trim();
  if (!id) throw new TypeError('embedding provider id is required');
  if (typeof provider.embed !== 'function') throw new TypeError(`embedding provider ${id} requires embed()`);
  if (!Number.isInteger(Number(provider.dimensions)) || Number(provider.dimensions) <= 0) throw new TypeError(`embedding provider ${id} requires positive dimensions`);
  return id;
}

function guarded(provider) {
  return Object.freeze({
    id: String(provider.id),
    kind: String(provider.kind ?? (provider.degraded ? 'fallback' : 'neural')),
    dimensions: Number(provider.dimensions),
    degraded: provider.degraded === true,
    modelSha256: provider.modelSha256 == null ? null : String(provider.modelSha256),
    async available() { return typeof provider.available === 'function' ? Boolean(await provider.available()) : true; },
    async embed(texts, options = {}) {
      if (!Array.isArray(texts)) throw new TypeError('embedding texts must be an array');
      if (options?.signal?.aborted) throw options.signal.reason ?? coded('EMBEDDING_ABORTED', 'Embedding request aborted');
      const result = await provider.embed(texts, options);
      if (!Array.isArray(result) || result.length !== texts.length) throw coded('EMBEDDING_RESULT_INVALID', `Embedding provider ${provider.id} returned an invalid batch`);
      for (const vector of result) {
        if (!Array.isArray(vector) && !ArrayBuffer.isView(vector)) throw coded('EMBEDDING_RESULT_INVALID', `Embedding provider ${provider.id} returned a non-vector result`);
        if (vector.length !== Number(provider.dimensions)) throw coded('EMBEDDING_DIMENSION_MISMATCH', `Embedding provider ${provider.id} returned ${vector.length} dimensions; expected ${provider.dimensions}`);
      }
      return result.map((vector) => Array.from(vector, (value) => Number(value) || 0));
    },
    async close() { if (typeof provider.close === 'function') await provider.close(); },
  });
}

export class FeatureHashEmbeddingProvider {
  constructor({ dimensions = 256, id = 'forge-feature-hash-v1' } = {}) {
    this.dimensions = Math.max(16, Math.min(4_096, Number(dimensions) || 256));
    this.id = String(id);
    this.kind = 'feature-hash';
    this.degraded = true;
    this.modelSha256 = null;
  }

  async available() { return true; }

  async embed(texts, { signal } = {}) {
    if (!Array.isArray(texts)) throw new TypeError('embedding texts must be an array');
    if (signal?.aborted) throw signal.reason ?? coded('EMBEDDING_ABORTED', 'Embedding request aborted');
    return texts.map((text) => {
      const vector = Array(this.dimensions).fill(0);
      const values = tokens(text);
      for (let index = 0; index < values.length; index += 1) {
        const token = values[index];
        const digest = createHash('sha256').update(token).digest();
        const bucket = digest.readUInt32BE(0) % this.dimensions;
        const sign = (digest[4] & 1) === 0 ? 1 : -1;
        const weight = 1 + Math.log1p(values.length - index) / 10;
        vector[bucket] += sign * weight;
      }
      return normalize(vector);
    });
  }
}

export class EmbeddingProviderRegistry {
  constructor({ providers = [] } = {}) {
    this.providers = new Map();
    for (const provider of providers) this.register(provider);
  }

  register(provider) {
    const id = validateProvider(provider);
    if (this.providers.has(id)) throw new Error(`Embedding provider ${id} is already registered`);
    const wrapped = guarded(provider);
    this.providers.set(id, wrapped);
    return wrapped;
  }

  get(id) { return this.providers.get(String(id)) ?? null; }

  async resolve({ preferNeural = true, allowFallback = true, providerId = null } = {}) {
    if (providerId) {
      const selected = this.get(providerId);
      if (!selected) throw coded('EMBEDDING_PROVIDER_NOT_FOUND', `Embedding provider ${providerId} is not registered`);
      const available = await selected.available();
      if (!available) throw coded('EMBEDDING_PROVIDER_UNAVAILABLE', `Embedding provider ${providerId} is unavailable`);
      return frozen({ provider: selected, degraded: selected.degraded, reason: selected.degraded ? 'explicit-degraded-provider' : 'explicit-provider' });
    }
    const all = [...this.providers.values()];
    const neural = all.filter((provider) => provider.kind === 'neural' && !provider.degraded);
    if (preferNeural) {
      for (const provider of neural) {
        if (await provider.available()) return frozen({ provider, degraded: false, reason: 'neural-available' });
      }
    }
    if (allowFallback) {
      for (const provider of all.filter((candidate) => candidate.degraded || candidate.kind !== 'neural')) {
        if (await provider.available()) return frozen({ provider, degraded: true, reason: preferNeural && neural.length ? 'neural-unavailable-fallback' : 'fallback-selected' });
      }
    }
    throw coded('NEURAL_EMBEDDING_UNAVAILABLE', 'No available neural embedding provider is registered');
  }

  async status() {
    const providers = [];
    for (const provider of this.providers.values()) {
      let available = false;
      try { available = await provider.available(); } catch { available = false; }
      providers.push(descriptor(provider, available));
    }
    providers.sort((left, right) => left.id.localeCompare(right.id));
    return frozen({ schema: 'forge.embedding-provider-registry.v1', providers });
  }

  async close() {
    await Promise.allSettled([...this.providers.values()].map((provider) => provider.close()));
  }
}

export function cosineSimilarity(left, right) {
  if ((!Array.isArray(left) && !ArrayBuffer.isView(left)) || (!Array.isArray(right) && !ArrayBuffer.isView(right)) || left.length !== right.length || !left.length) return 0;
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]) || 0; const b = Number(right[index]) || 0;
    dot += a * b; leftNorm += a * a; rightNorm += b * b;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}
