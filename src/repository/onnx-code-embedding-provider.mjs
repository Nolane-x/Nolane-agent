import { EmbeddingModelPack } from './embedding-model-pack.mjs';

function coded(code, message) { const error = new Error(message); error.code = code; return error; }
function normalize(vector) {
  const values = Array.from(vector, (value) => Number(value) || 0);
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? values.map((value) => value / norm) : values;
}
function meanPool(tokenEmbeddings, attentionMask, dimensions) {
  const output = Array(dimensions).fill(0); let count = 0;
  for (let index = 0; index < tokenEmbeddings.length; index += 1) {
    if (!attentionMask?.[index]) continue;
    const token = tokenEmbeddings[index];
    if (!Array.isArray(token) && !ArrayBuffer.isView(token)) throw coded('EMBEDDING_RESULT_INVALID', 'ONNX runtime returned invalid token embeddings');
    for (let dimension = 0; dimension < dimensions; dimension += 1) output[dimension] += Number(token[dimension]) || 0;
    count += 1;
  }
  if (count) for (let dimension = 0; dimension < dimensions; dimension += 1) output[dimension] /= count;
  return normalize(output);
}

export class OnnxCodeEmbeddingProvider {
  constructor({ pack = null, packRoot = null, runtimeFactory, idleTtlMs = 60_000, clock = () => Date.now() } = {}) {
    if (!runtimeFactory || typeof runtimeFactory.createSession !== 'function') throw new TypeError('runtimeFactory.createSession is required');
    this.pack = pack;
    this.packRoot = packRoot;
    this.runtimeFactory = runtimeFactory;
    this.id = pack ? `${pack.modelId}:${pack.modelSha256.slice(0, 12)}` : 'forge-onnx-code-embedding-unavailable';
    this.kind = 'neural'; this.degraded = false; this.dimensions = pack?.dimensions ?? 1; this.modelSha256 = pack?.modelSha256 ?? null;
    this.idleTtlMs = Math.max(1, Number(idleTtlMs) || 60_000); this.clock = clock;
    this.session = null; this.lastUsedAtMs = null; this.loadingPack = null;
  }

  async #resolvePack() {
    if (this.pack) return this.pack;
    if (!this.packRoot) throw coded('EMBEDDING_MODEL_NOT_INSTALLED', 'Embedding model pack is not installed');
    if (!this.loadingPack) this.loadingPack = EmbeddingModelPack.open(this.packRoot).then((pack) => {
      this.pack = pack; this.id = `${pack.modelId}:${pack.modelSha256.slice(0, 12)}`; this.dimensions = pack.dimensions; this.modelSha256 = pack.modelSha256; return pack;
    }).catch((error) => { this.loadingPack = null; throw error; });
    return this.loadingPack;
  }

  async available() { try { await this.#resolvePack(); return true; } catch { return false; } }

  async #session() {
    const pack = await this.#resolvePack();
    if (!this.session) this.session = await this.runtimeFactory.createSession({ modelPath: pack.modelPath, tokenizerPath: pack.tokenizerPath, modelSha256: pack.modelSha256, dimensions: pack.dimensions, quantization: pack.quantization });
    return { pack, session: this.session };
  }

  async embed(texts, { signal } = {}) {
    if (!Array.isArray(texts)) throw new TypeError('embedding texts must be an array');
    if (signal?.aborted) throw signal.reason ?? coded('EMBEDDING_ABORTED', 'Embedding request aborted');
    const { pack, session } = await this.#session();
    const raw = await session.run({ texts, tokenizerPath: pack.tokenizerPath, signal });
    let vectors;
    if (Array.isArray(raw?.vectors)) vectors = raw.vectors.map(normalize);
    else if (Array.isArray(raw?.tokenEmbeddings)) vectors = raw.tokenEmbeddings.map((tokens, index) => meanPool(tokens, raw.attentionMask?.[index] ?? [], pack.dimensions));
    else throw coded('EMBEDDING_RESULT_INVALID', 'ONNX runtime returned no vectors');
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== pack.dimensions)) throw coded('EMBEDDING_DIMENSION_MISMATCH', 'ONNX embedding result dimensions do not match the model pack');
    this.lastUsedAtMs = this.clock();
    return vectors;
  }

  async unloadIdle({ nowMs = this.clock() } = {}) {
    if (!this.session || this.lastUsedAtMs == null || nowMs - this.lastUsedAtMs < this.idleTtlMs) return false;
    const session = this.session; this.session = null; this.lastUsedAtMs = null;
    if (typeof session.close === 'function') await session.close();
    return true;
  }

  async close() {
    if (!this.session) return;
    const session = this.session; this.session = null; this.lastUsedAtMs = null;
    if (typeof session.close === 'function') await session.close();
  }
}
