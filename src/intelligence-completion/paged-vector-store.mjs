import { createHash } from 'node:crypto';
import { boundedArray, sha, signed, text } from './completion-utils.mjs';

const MAGIC = Buffer.from('FGV1');
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function clampInt8(value) { const n = Math.round(Number(value)); if (!Number.isFinite(n)) throw new TypeError('vector values must be finite'); return Math.max(-128, Math.min(127, n)); }
function normalizeVector(value, label, dimension = null) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) throw new TypeError(`${label} must be an array or typed array`);
  const result = [...value].map(clampInt8);
  if (!result.length) throw new TypeError(`${label} must not be empty`);
  if (dimension != null && result.length !== dimension) throw new TypeError(`${label} dimension mismatch: expected ${dimension}, received ${result.length}`);
  return result;
}
function dot(a, b) { let value = 0; let aa = 0; let bb = 0; for (let i = 0; i < a.length; i += 1) { value += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return aa && bb ? value / Math.sqrt(aa * bb) : 0; }
function pageKey(indexId, pageId) { return `${indexId}\u0000${pageId}`; }

function encodePage(records, dimension) {
  const chunks = [];
  const header = Buffer.alloc(8);
  MAGIC.copy(header, 0); header.writeUInt16BE(dimension, 4); header.writeUInt16BE(records.length, 6); chunks.push(header);
  for (const record of records) {
    const id = Buffer.from(record.id, 'utf8');
    const metadata = Buffer.from(JSON.stringify(record.metadata ?? {}), 'utf8');
    if (id.length > 65_535) throw new RangeError('record id is too large');
    if (metadata.length > 4_000_000) throw new RangeError('record metadata is too large');
    const prefix = Buffer.alloc(6);
    prefix.writeUInt16BE(id.length, 0); prefix.writeUInt32BE(metadata.length, 2);
    const vector = Buffer.alloc(dimension); record.vector.forEach((value, index) => vector.writeInt8(value, index));
    chunks.push(prefix, Buffer.from(record.contentSha256, 'hex'), vector, id, metadata);
  }
  return Buffer.concat(chunks);
}

function decodePage(bytes, expectedDimension) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 8 || !buffer.subarray(0, 4).equals(MAGIC)) throw new Error('invalid vector page magic');
  const dimension = buffer.readUInt16BE(4); const count = buffer.readUInt16BE(6);
  if (dimension !== expectedDimension) throw new Error(`vector page dimension mismatch: expected ${expectedDimension}, received ${dimension}`);
  const records = []; let offset = 8;
  for (let i = 0; i < count; i += 1) {
    if (offset + 6 + 32 + dimension > buffer.length) throw new Error('truncated vector page');
    const idLength = buffer.readUInt16BE(offset); const metadataLength = buffer.readUInt32BE(offset + 2); offset += 6;
    const contentSha256 = buffer.subarray(offset, offset + 32).toString('hex'); offset += 32;
    const vector = Array.from({ length: dimension }, (_, index) => buffer.readInt8(offset + index)); offset += dimension;
    if (offset + idLength + metadataLength > buffer.length) throw new Error('truncated vector page record');
    const id = buffer.subarray(offset, offset + idLength).toString('utf8'); offset += idLength;
    let metadata;
    try { metadata = JSON.parse(buffer.subarray(offset, offset + metadataLength).toString('utf8')); } catch { throw new Error('invalid vector page metadata'); }
    offset += metadataLength;
    records.push({ id, vector, metadata, contentSha256 });
  }
  if (offset !== buffer.length) throw new Error('unexpected vector page trailing bytes');
  return { dimension, records };
}

export class PagedVectorStore {
  constructor({ pageSize = 256, maxLoadedBytes = 8 * 1024 * 1024, defaultMaxPages = 4, storage = null } = {}) {
    this.pageSize = Math.max(1, Math.min(4096, Math.floor(Number(pageSize) || 256)));
    this.maxLoadedBytes = Math.max(1, Math.floor(Number(maxLoadedBytes) || 8 * 1024 * 1024));
    this.defaultMaxPages = Math.max(1, Math.min(128, Math.floor(Number(defaultMaxPages) || 4)));
    this.storage = storage;
    this.indexes = new Map();
    this.pages = new Map();
    this.closed = false;
  }

  #assertOpen() { if (this.closed) throw new Error('paged vector store is closed'); }

  async build(input = {}) {
    this.#assertOpen();
    const indexId = text(input.indexId, 'indexId', 256);
    const raw = boundedArray(input.records, 'records', 1_000_000);
    if (!raw.length) throw new TypeError('records must not be empty');
    const seen = new Set();
    const firstVector = normalizeVector(raw[0]?.vector, 'records[0].vector');
    const dimension = firstVector.length;
    const records = raw.map((record, index) => {
      const id = text(record?.id, `records[${index}].id`, 65_535);
      if (seen.has(id)) throw new Error(`duplicate vector record id: ${id}`); seen.add(id);
      return { id, vector: index === 0 ? firstVector : normalizeVector(record?.vector, `records[${index}].vector`, dimension), metadata: structuredClone(record?.metadata ?? {}), contentSha256: sha(record?.contentSha256, `records[${index}].contentSha256`) };
    });
    const pages = [];
    for (let offset = 0, number = 0; offset < records.length; offset += this.pageSize, number += 1) {
      const slice = records.slice(offset, offset + this.pageSize);
      const pageId = `page-${String(number + 1).padStart(6, '0')}`;
      const bytes = encodePage(slice, dimension);
      if (bytes.length > this.maxLoadedBytes) throw new RangeError(`vector page budget exceeded: ${bytes.length} > ${this.maxLoadedBytes}`);
      const centroid = Array.from({ length: dimension }, (_, axis) => Math.round(slice.reduce((sum, item) => sum + item.vector[axis], 0) / slice.length));
      const meta = { pageId, pageSha256: digest(bytes), bytes: bytes.length, count: slice.length, dimension, firstId: slice[0].id, lastId: slice.at(-1).id, centroid };
      if (typeof this.storage?.writePage === 'function') await this.storage.writePage({ indexId, pageId, bytes: Buffer.from(bytes), metadata: meta });
      else this.pages.set(pageKey(indexId, pageId), Buffer.from(bytes));
      pages.push(meta);
    }
    const manifestBase = { schema: 'forge.paged-vector-manifest.v1', indexId, dimension, recordCount: records.length, pageSize: this.pageSize, totalVectorBytes: pages.reduce((sum, page) => sum + page.bytes, 0), pages };
    const manifest = signed(manifestBase);
    this.indexes.set(indexId, manifest);
    return signed({ schema: 'forge.paged-vector-build.v1', manifest, claims: { fullIndexRequiredAtQueryTime: false, pageChecksumsEnforced: true } });
  }

  async #rawPage(indexId, pageId) {
    if (typeof this.storage?.readPage === 'function') return Buffer.from(await this.storage.readPage({ indexId, pageId }));
    const bytes = this.pages.get(pageKey(indexId, pageId));
    if (!bytes) throw new RangeError(`vector page not found: ${pageId}`);
    return Buffer.from(bytes);
  }

  async readPage(input = {}) {
    this.#assertOpen();
    const indexId = text(input.indexId, 'indexId', 256); const pageId = text(input.pageId, 'pageId', 256);
    const manifest = this.indexes.get(indexId); if (!manifest) throw new RangeError(`vector index not found: ${indexId}`);
    const page = manifest.pages.find((candidate) => candidate.pageId === pageId); if (!page) throw new RangeError(`vector page not found: ${pageId}`);
    const bytes = await this.#rawPage(indexId, pageId);
    if (bytes.length > this.maxLoadedBytes) throw new RangeError('vector page exceeds loaded-byte budget');
    if (digest(bytes) !== page.pageSha256) throw new Error(`vector page checksum mismatch: ${pageId}`);
    const decoded = decodePage(bytes, manifest.dimension);
    return signed({ schema: 'forge.paged-vector-page.v1', indexId, pageId, bytes: bytes.length, dimension: decoded.dimension, records: decoded.records, pageSha256: page.pageSha256 });
  }

  async search(input = {}) {
    this.#assertOpen();
    const indexId = text(input.indexId, 'indexId', 256); const manifest = this.indexes.get(indexId); if (!manifest) throw new RangeError(`vector index not found: ${indexId}`);
    const queryVector = normalizeVector(input.queryVector, 'queryVector', manifest.dimension);
    const limit = Math.max(1, Math.min(10_000, Math.floor(Number(input.limit) || 20)));
    let pageIds;
    if (input.pageIds != null) {
      pageIds = boundedArray(input.pageIds, 'pageIds', 128).map((value) => text(value, 'pageId', 256));
    } else {
      const maximum = Math.max(1, Math.min(manifest.pages.length, Math.floor(Number(input.maxPages) || this.defaultMaxPages)));
      pageIds = manifest.pages.map((page) => ({ pageId: page.pageId, score: dot(queryVector, page.centroid) })).sort((a, b) => b.score - a.score || a.pageId.localeCompare(b.pageId)).slice(0, maximum).map((entry) => entry.pageId);
    }
    pageIds = [...new Set(pageIds)];
    const items = []; let bytesRead = 0; let peakLoadedBytes = 0;
    for (const pageId of pageIds) {
      const page = await this.readPage({ indexId, pageId });
      bytesRead += page.bytes; peakLoadedBytes = Math.max(peakLoadedBytes, page.bytes);
      for (const record of page.records) items.push({ id: record.id, score: Number(dot(queryVector, record.vector).toFixed(8)), metadata: record.metadata, contentSha256: record.contentSha256, pageId });
    }
    items.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return signed({
      schema: 'forge.paged-vector-search.v1', indexId, dimension: manifest.dimension, items: items.slice(0, limit),
      telemetry: { pagesRead: pageIds.length, pageIds, bytesRead, peakLoadedBytes, totalVectorBytes: manifest.totalVectorBytes },
      claims: { fullIndexLoadedIntoMemory: pageIds.length === manifest.pages.length && manifest.pages.length === 1, mmapClaimed: false, pagedReadUsed: true },
    });
  }

  verify() {
    return signed({ schema: 'forge.paged-vector-store-verification.v1', indexes: [...this.indexes.values()].map((manifest) => ({ indexId: manifest.indexId, manifestReceiptSha256: manifest.receiptSha256, pages: manifest.pages.length, records: manifest.recordCount })), claims: { pageChecksumsRequired: true } });
  }

  snapshot() {
    return signed({ schema: 'forge.paged-vector-store-snapshot.v1', closed: this.closed, indexes: [...this.indexes.values()].map((manifest) => ({ indexId: manifest.indexId, dimension: manifest.dimension, records: manifest.recordCount, pages: manifest.pages.length, totalVectorBytes: manifest.totalVectorBytes, manifestReceiptSha256: manifest.receiptSha256 })), claims: { vectorsIncluded: false } });
  }

  async close() { this.closed = true; this.pages.clear(); this.indexes.clear(); if (typeof this.storage?.close === 'function') await this.storage.close(); }

  __testCorruptPage(pageId) {
    for (const [key, bytes] of this.pages) if (key.endsWith(`\u0000${pageId}`)) { const copy = Buffer.from(bytes); copy[0] ^= 0xff; this.pages.set(key, copy); return; }
    throw new RangeError(`vector page not found: ${pageId}`);
  }
}
