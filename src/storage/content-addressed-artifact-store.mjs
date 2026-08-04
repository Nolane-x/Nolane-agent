import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const PRIVATE_KEY = /(?:raw(?:Prompt|Output|Transcript)|chainOfThought|hiddenReasoning|password|secret|credential|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)/i;
const HASH = /^[a-f0-9]{64}$/i;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function text(value, label, max = 2_000) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}
function boundedText(value, max = 2_000) { return String(value ?? '').slice(0, max); }
function assertPublicMetadata(value, pathLabel = '$', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new TypeError(`cyclic private metadata at ${pathLabel}`);
  seen.add(value);
  try {
    for (const [key, child] of Object.entries(value)) {
      if (PRIVATE_KEY.test(key)) throw new TypeError(`secret or private metadata is not allowed: ${pathLabel}.${key}`);
      assertPublicMetadata(child, `${pathLabel}.${key}`, seen);
    }
  } finally { seen.delete(value); }
}
function boundedClone(value, depth = 0) {
  if (depth > 5) throw new TypeError('artifact metadata is too deeply nested');
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 1_000);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('artifact metadata contains a non-finite number');
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > 64) throw new TypeError('artifact metadata array is too large');
    return value.map((item) => boundedClone(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value).slice(0, 1_000);
  const entries = Object.entries(value);
  if (entries.length > 64) throw new TypeError('artifact metadata object is too large');
  return Object.fromEntries(entries.map(([key, child]) => [key.slice(0, 128), boundedClone(child, depth + 1)]));
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function normalizeBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  throw new TypeError('artifact data must be a string, Buffer, or Uint8Array');
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }

export class ContentAddressedArtifactStore {
  constructor({ root, maxHotEntries = 1_000, maxPreviewBytes = 4_096, clock = () => Date.now() } = {}) {
    this.root = path.resolve(text(root, 'root', 4_096));
    this.blobRoot = path.join(this.root, 'blobs');
    this.maxHotEntries = Math.max(1, Math.floor(Number(maxHotEntries) || 1_000));
    this.maxPreviewBytes = Math.max(0, Math.floor(Number(maxPreviewBytes) || 4_096));
    this.clock = clock;
    this.records = new Map();
    this.tombstones = new Map();
  }

  #blobPath(sha256) { return path.join(this.blobRoot, sha256.slice(0, 2), sha256); }
  #touch(sha256, record) {
    this.records.delete(sha256);
    this.records.set(sha256, record);
    while (this.records.size > this.maxHotEntries) this.records.delete(this.records.keys().next().value);
  }
  #requireHash(value) {
    const hash = String(value ?? '').toLowerCase();
    if (!HASH.test(hash)) throw new TypeError('sha256 must be a SHA-256 hash');
    return hash;
  }
  #projection(record, maxBytes = this.maxPreviewBytes) {
    const limit = Math.max(0, Math.min(this.maxPreviewBytes, Math.floor(Number(maxBytes) || 0)));
    const previewBuffer = record.previewBuffer.subarray(0, Math.min(limit, record.previewBuffer.length));
    return freeze({
      rawArtifactSha256: record.sha256,
      kind: record.kind,
      summary: record.summary,
      preview: previewBuffer.toString('utf8'),
      bytes: record.bytes,
      truncated: record.bytes > previewBuffer.length,
      rawStoredInMemory: false,
      refs: record.refs,
    });
  }

  async put({ kind, data, refs = {}, summary = '' } = {}) {
    assertPublicMetadata(refs, '$.refs');
    const cleanRefs = freeze(boundedClone(refs));
    const cleanKind = text(kind, 'kind', 128);
    const cleanSummary = boundedText(summary, 2_000);
    const body = normalizeBuffer(data);
    const sha256 = createHash('sha256').update(body).digest('hex');
    const filePath = this.#blobPath(sha256);
    await mkdir(path.dirname(filePath), { recursive: true });
    const deduplicated = await exists(filePath);
    if (!deduplicated) {
      const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, body, { flag: 'wx', mode: 0o600 });
      try { await rename(temporary, filePath); }
      catch (error) {
        if (!(await exists(filePath))) throw error;
        await rm(temporary, { force: true });
      }
    }
    const record = {
      sha256, filePath, kind: cleanKind, summary: cleanSummary, refs: cleanRefs, bytes: body.length,
      previewBuffer: Buffer.from(body.subarray(0, this.maxPreviewBytes)), createdAtMs: Math.trunc(Number(this.clock())),
    };
    this.#touch(sha256, record);
    const base = {
      schema: 'forge.content-addressed-artifact.v1', sha256, filePath, kind: cleanKind, summary: cleanSummary,
      refs: cleanRefs, bytes: body.length, deduplicated, projection: this.#projection(record), createdAtMs: record.createdAtMs,
    };
    return signed(base);
  }

  async #recordFor(hash) {
    const sha256 = this.#requireHash(hash);
    if (this.tombstones.has(sha256)) throw new Error(`Artifact not found: ${sha256}`);
    let record = this.records.get(sha256);
    if (record) { this.#touch(sha256, record); return record; }
    const filePath = this.#blobPath(sha256);
    let info;
    try { info = await stat(filePath); } catch { throw new Error(`Artifact not found: ${sha256}`); }
    const handle = await open(filePath, 'r');
    const previewBuffer = Buffer.alloc(Math.min(this.maxPreviewBytes, info.size));
    try { if (previewBuffer.length) await handle.read(previewBuffer, 0, previewBuffer.length, 0); }
    finally { await handle.close(); }
    record = { sha256, filePath, kind: 'unknown', summary: '', refs: freeze({}), bytes: info.size, previewBuffer, createdAtMs: Math.trunc(info.birthtimeMs || info.ctimeMs) };
    this.#touch(sha256, record);
    return record;
  }

  async get(hash, { offset = 0, length = null } = {}) {
    const record = await this.#recordFor(hash);
    const start = Math.max(0, Math.min(record.bytes, Math.floor(Number(offset) || 0)));
    const requested = length == null ? record.bytes - start : Math.max(0, Math.floor(Number(length) || 0));
    const bytesToRead = Math.min(requested, record.bytes - start);
    const data = Buffer.alloc(bytesToRead);
    const handle = await open(record.filePath, 'r');
    let bytesRead = 0;
    try { if (bytesToRead) ({ bytesRead } = await handle.read(data, 0, bytesToRead, start)); }
    finally { await handle.close(); }
    const output = data.subarray(0, bytesRead);
    const nextOffset = start + bytesRead;
    return freeze({ sha256: record.sha256, offset: start, data: output, bytes: bytesRead, nextOffset, eof: nextOffset >= record.bytes });
  }

  contextProjection(hash, { maxBytes = this.maxPreviewBytes } = {}) {
    const sha256 = this.#requireHash(hash);
    const record = this.records.get(sha256);
    if (!record || this.tombstones.has(sha256)) throw new Error(`Artifact not found: ${sha256}`);
    this.#touch(sha256, record);
    return this.#projection(record, maxBytes);
  }

  async delete(hash, { actor, reason } = {}) {
    const sha256 = this.#requireHash(hash);
    const cleanActor = text(actor, 'actor', 256);
    const cleanReason = text(reason, 'reason', 1_000);
    const filePath = this.#blobPath(sha256);
    if (!(await exists(filePath)) && !this.records.has(sha256)) throw new Error(`Artifact not found: ${sha256}`);
    await rm(filePath, { force: true });
    this.records.delete(sha256);
    const base = { schema: 'forge.artifact-tombstone.v1', sha256, deleted: true, actor: cleanActor, reason: cleanReason, deletedAtMs: Math.trunc(Number(this.clock())) };
    const tombstone = signed(base);
    this.tombstones.set(sha256, tombstone);
    return tombstone;
  }

  snapshot() {
    const records = [...this.records.values()].map((record) => freeze({
      sha256: record.sha256, kind: record.kind, summary: record.summary, refs: record.refs, bytes: record.bytes,
      createdAtMs: record.createdAtMs, rawStoredInMemory: false,
    }));
    return signed({ schema: 'forge.content-addressed-artifact-store-snapshot.v1', uniqueBlobs: records.length, hotEntries: freeze(records), tombstoneCount: this.tombstones.size, claims: { rawArtifactBytesStoredInSnapshot: false } });
  }
}
