import { createHash } from 'node:crypto';

const MAGIC = Buffer.from('FSV1');
const CHECKSUM_BYTES = 32;
const sha256 = (value) => createHash('sha256').update(value).digest();
const shaHex = (value) => createHash('sha256').update(value).digest('hex');
function abort(signal) { if (signal?.aborted) throw signal.reason ?? new Error('semantic indexing aborted'); }
function finiteVector(vector, dimensions) {
  if (!Array.isArray(vector) && !ArrayBuffer.isView(vector)) throw new TypeError('embedding vector must be an array');
  if (vector.length !== dimensions) throw new Error(`embedding dimension mismatch: expected ${dimensions}, received ${vector.length}`);
  const values = Array.from(vector, Number);
  if (values.some((value) => !Number.isFinite(value))) throw new Error('embedding values must be finite');
  return values;
}

export function encodeVectorBlob(vector) {
  const values = Array.from(vector, Number);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new TypeError('vector values must be finite');
  const maxAbs = Math.max(...values.map(Math.abs), 1e-12); const scale = maxAbs / 127;
  const header = Buffer.alloc(11); MAGIC.copy(header, 0); header.writeUInt8(1, 4); header.writeUInt16LE(values.length, 5); header.writeFloatLE(scale, 7);
  const payload = Buffer.alloc(values.length);
  values.forEach((value, index) => payload.writeInt8(Math.max(-127, Math.min(127, Math.round(value / scale))), index));
  const body = Buffer.concat([header, payload]);
  return Buffer.concat([body, sha256(body)]);
}

export function decodeVectorBlob(blob) {
  const bytes = Buffer.from(blob);
  if (bytes.length < 11 + CHECKSUM_BYTES || !bytes.subarray(0, 4).equals(MAGIC)) throw new Error('invalid vector blob header');
  const version = bytes.readUInt8(4); const dimensions = bytes.readUInt16LE(5); const scale = bytes.readFloatLE(7);
  const expectedLength = 11 + dimensions + CHECKSUM_BYTES;
  if (bytes.length !== expectedLength) throw new Error('invalid vector blob dimensions');
  const body = bytes.subarray(0, bytes.length - CHECKSUM_BYTES); const checksum = bytes.subarray(bytes.length - CHECKSUM_BYTES);
  if (!sha256(body).equals(checksum)) throw new Error('vector blob checksum mismatch');
  const values = Array.from({ length: dimensions }, (_, index) => bytes.readInt8(11 + index) * scale);
  if (values.some((value) => !Number.isFinite(value))) throw new Error('vector blob contains non-finite values');
  return Object.freeze({ version, dimensions, scale, values: Object.freeze(values), checksumSha256: checksum.toString('hex') });
}

export class SemanticIndexRuntime {
  constructor({ batchSize = 32, maxConcurrency = 2, maxQueuedBatches = 4, idleTtlMs = 60_000, clock = () => Date.now() } = {}) {
    this.batchSize = Math.max(1, Number(batchSize) || 32); this.maxConcurrency = Math.max(1, Number(maxConcurrency) || 2); this.maxQueuedBatches = Math.max(1, Number(maxQueuedBatches) || 4);
    this.idleTtlMs = Math.max(1, Number(idleTtlMs) || 60_000); this.clock = clock;
    this.cache = new Map(); this.quarantined = new Map(); this.lastUsedAtMs = null; this.metrics = { peakRssMb: 0, rssMbSeconds: 0 };
  }
  #key(chunk, provider) { return [chunk.contentHash, provider.modelSha256, provider.tokenizerSha256, chunk.schemaVersion].join(':'); }
  cacheSize() { return this.cache.size; }

  async index(chunks, { provider, signal, resourceSamples = [] } = {}) {
    if (!Array.isArray(chunks)) throw new TypeError('chunks must be an array');
    if (!provider?.embed || !provider.modelSha256 || !provider.tokenizerSha256 || !Number.isInteger(provider.dimensions)) throw new TypeError('verified embedding provider is required');
    abort(signal);
    const records = new Array(chunks.length); const misses = []; let cacheHits = 0;
    chunks.forEach((chunk, index) => {
      const key = this.#key(chunk, provider); const cached = this.cache.get(key);
      if (cached) { records[index] = cached; cacheHits += 1; } else misses.push({ chunk, index, key });
    });
    const batches = [];
    for (let offset = 0; offset < misses.length; offset += this.batchSize) batches.push(misses.slice(offset, offset + this.batchSize));
    let cursor = 0; let failure = null;
    const workers = Array.from({ length: Math.min(this.maxConcurrency, batches.length) }, async () => {
      while (!failure) {
        abort(signal); const batchIndex = cursor; cursor += 1; if (batchIndex >= batches.length) return;
        const batch = batches[batchIndex];
        try {
          const vectors = await provider.embed(batch.map(({ chunk }) => String(chunk.content ?? '')), { signal });
          if (!Array.isArray(vectors) || vectors.length !== batch.length) throw new Error('embedding provider returned an invalid batch');
          const staged = batch.map((item, index) => {
            const values = finiteVector(vectors[index], provider.dimensions); const vectorBlob = encodeVectorBlob(values); decodeVectorBlob(vectorBlob);
            return Object.freeze({ id: String(item.chunk.id), contentHash: String(item.chunk.contentHash), cacheKey: item.key, vectorBlob, vectorSha256: shaHex(vectorBlob), dimensions: provider.dimensions });
          });
          staged.forEach((record, index) => { const item = batch[index]; this.cache.set(item.key, record); records[item.index] = record; });
        } catch (error) { failure = error; return; }
      }
    });
    await Promise.all(workers); if (failure) throw failure;
    this.lastUsedAtMs = this.clock(); this.#recordResources(resourceSamples);
    return Object.freeze({ schema: 'forge.semantic-index-runtime.v1', indexed: misses.length, cacheHits, records: Object.freeze(records), batches: batches.length, maxConcurrency: this.maxConcurrency, maxQueuedBatches: this.maxQueuedBatches, cacheKeyFields: Object.freeze(['contentHash', 'modelSha256', 'tokenizerSha256', 'chunkSchema']) });
  }

  #recordResources(samples) {
    const sorted = [...samples].map((sample) => ({ atMs: Number(sample.atMs), rssMb: Number(sample.rssMb) })).filter((sample) => Number.isFinite(sample.atMs) && Number.isFinite(sample.rssMb)).sort((a, b) => a.atMs - b.atMs);
    for (const sample of sorted) this.metrics.peakRssMb = Math.max(this.metrics.peakRssMb, sample.rssMb);
    for (let index = 1; index < sorted.length; index += 1) this.metrics.rssMbSeconds += ((sorted[index - 1].rssMb + sorted[index].rssMb) / 2) * ((sorted[index].atMs - sorted[index - 1].atMs) / 1000);
  }
  resourceMetrics() { return Object.freeze({ peakRssMb: this.metrics.peakRssMb, rssMbSeconds: this.metrics.rssMbSeconds }); }
  quarantine({ id, reason, blob }) { const record = Object.freeze({ id: String(id), reason: String(reason), blobSha256: shaHex(Buffer.from(blob)), status: 'quarantined' }); this.quarantined.set(record.id, record); return record; }
  rank(_query, candidates = []) {
    const priority = (entry) => entry.exactSymbol ? 4 : entry.callerMatch ? 3 : entry.testMatch ? 2 : entry.typeMatch ? 1 : 0;
    return Object.freeze([...candidates].sort((a, b) => priority(b) - priority(a) || Number(b.semantic ?? 0) - Number(a.semantic ?? 0) || String(a.id).localeCompare(String(b.id))).map(Object.freeze));
  }
  async unload({ pressure = 'normal', provider, nowMs = this.clock() } = {}) {
    const idle = this.lastUsedAtMs != null && nowMs - this.lastUsedAtMs >= this.idleTtlMs;
    if (pressure !== 'high' && pressure !== 'critical' && !idle) return false;
    if (provider?.close) await provider.close(); this.lastUsedAtMs = null; return true;
  }
}
