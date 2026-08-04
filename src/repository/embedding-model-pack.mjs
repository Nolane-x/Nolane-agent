import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function coded(code, message) { const error = new Error(message); error.code = code; return error; }
function safeRelative(value) {
  const normalized = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.includes('../')) throw coded('EMBEDDING_PACK_INVALID', `Unsafe embedding pack path: ${value}`);
  return normalized;
}
function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])));
}

export class EmbeddingModelPack {
  static async open(root) {
    const packRoot = path.resolve(String(root ?? ''));
    let manifest;
    try { manifest = JSON.parse(await readFile(path.join(packRoot, 'embedding-pack.json'), 'utf8')); }
    catch { throw coded('EMBEDDING_MODEL_NOT_INSTALLED', `Embedding model pack is not installed at ${packRoot}`); }
    if (manifest?.schema !== 'forge.embedding-model-pack.v1') throw coded('EMBEDDING_PACK_INVALID', 'Unsupported embedding model pack schema');
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    if (!files.length) throw coded('EMBEDDING_PACK_INVALID', 'Embedding model pack has no files');
    const verified = [];
    for (const entry of files) {
      const relative = safeRelative(entry.path);
      const absolute = path.join(packRoot, relative);
      let info; let bytes;
      try { [info, bytes] = await Promise.all([stat(absolute), readFile(absolute)]); }
      catch { throw coded('EMBEDDING_PACK_INTEGRITY_FAILED', `Embedding pack file missing: ${relative}`); }
      if (!info.isFile() || info.size !== Number(entry.bytes) || sha256(bytes) !== String(entry.sha256)) throw coded('EMBEDDING_PACK_INTEGRITY_FAILED', `Embedding pack integrity failed: ${relative}`);
      verified.push({ role: String(entry.role), path: relative, absolutePath: absolute, bytes: info.size, sha256: String(entry.sha256) });
    }
    const model = verified.find((entry) => entry.role === 'model');
    const tokenizer = verified.find((entry) => entry.role === 'tokenizer');
    if (!model || !tokenizer) throw coded('EMBEDDING_PACK_INVALID', 'Embedding pack requires model and tokenizer files');
    if (model.sha256 !== String(manifest.modelSha256) || tokenizer.sha256 !== String(manifest.tokenizerSha256)) throw coded('EMBEDDING_PACK_INTEGRITY_FAILED', 'Embedding pack manifest digest mismatch');
    const semantic = {
      schema: manifest.schema,
      root: packRoot,
      modelId: String(manifest.modelId),
      modelSha256: String(manifest.modelSha256),
      tokenizerSha256: String(manifest.tokenizerSha256),
      dimensions: Math.max(1, Number(manifest.dimensions) || 0),
      quantization: String(manifest.quantization ?? 'unknown'),
      files: verified,
    };
    return freeze({ ...semantic, modelPath: model.absolutePath, tokenizerPath: tokenizer.absolutePath, receiptSha256: sha256(JSON.stringify(semantic)) });
  }
}
