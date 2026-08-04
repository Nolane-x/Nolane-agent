import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalSha256, canonicalStringify } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const STREAM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'apikey', 'authorization', 'cookie', 'cookies', 'credential', 'credentials', 'env', 'environment',
  'password', 'privatekey', 'prompt', 'rawprompt', 'modeloutput', 'rawoutput', 'chainofthought',
  'reasoningtrace', 'secret', 'systemprompt', 'token', 'accesstoken', 'refreshtoken',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function signed(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function streamId(value) {
  const output = String(value ?? '').trim();
  if (!STREAM_ID.test(output) || output.includes('..')) throw new TypeError('streamId must be a safe local identifier');
  return output;
}
function boundedInteger(value, fallback, min, max, label) {
  const output = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(output) || output < min || output > max) throw new TypeError(`${label} must be an integer between ${min} and ${max}`);
  return output;
}
function redactString(value) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g, REDACTED);
}
function sanitize(value, limits, path = '$', depth = 0, stack = new WeakSet()) {
  if (depth > limits.maxDepth) throw new TypeError(`raw log record exceeds depth at ${path}`);
  if (value === null) return null;
  if (typeof value === 'string') return redactString(value.slice(0, limits.maxString));
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`raw log record contains a non-finite number at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw new TypeError(`raw log record contains a non-JSON value at ${path}`);
  if (stack.has(value)) throw new TypeError(`raw log record is cyclic at ${path}`);
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > limits.maxArray) throw new TypeError(`raw log array exceeds ${limits.maxArray} items at ${path}`);
      return value.map((item, index) => sanitize(item, limits, `${path}[${index}]`, depth + 1, stack));
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError(`raw log record must use plain objects at ${path}`);
    const entries = Object.entries(value);
    if (entries.length > limits.maxKeys) throw new TypeError(`raw log object exceeds ${limits.maxKeys} keys at ${path}`);
    const output = {};
    for (const [key, child] of entries) {
      const normalized = key.replaceAll('-', '').replaceAll('_', '').toLowerCase();
      const safeKey = key.slice(0, 256);
      output[safeKey] = SENSITIVE_KEYS.has(normalized) ? REDACTED : sanitize(child, limits, `${path}.${safeKey}`, depth + 1, stack);
    }
    return output;
  } finally { stack.delete(value); }
}

function encodeFrame(envelope) {
  const payload = Buffer.from(canonicalStringify(envelope), 'utf8');
  const header = Buffer.from(`${payload.length.toString(16).padStart(8, '0')}:`, 'ascii');
  return Buffer.concat([header, payload, Buffer.from('\n')]);
}

function parseFrames(buffer, { stream, tolerateTruncatedTail = true } = {}) {
  const frames = [];
  let offset = 0;
  let previousReceiptSha256 = null;
  let expectedSequence = 1;
  let truncatedTail = false;
  while (offset < buffer.length) {
    const frameStart = offset;
    if (buffer.length - offset < 9) { truncatedTail = true; break; }
    const lengthText = buffer.subarray(offset, offset + 8).toString('ascii');
    if (!/^[a-f0-9]{8}$/i.test(lengthText) || buffer[offset + 8] !== 58) throw new Error(`corrupt raw log frame header in ${stream}`);
    const payloadLength = Number.parseInt(lengthText, 16);
    const payloadStart = offset + 9;
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd + 1 > buffer.length) { truncatedTail = true; break; }
    if (buffer[payloadEnd] !== 10) throw new Error(`corrupt raw log frame delimiter in ${stream}`);
    let envelope;
    try { envelope = JSON.parse(buffer.subarray(payloadStart, payloadEnd).toString('utf8')); }
    catch { throw new Error(`corrupt raw log JSON in ${stream}`); }
    if (!envelope || envelope.schema !== 'forge.disk-raw-log-record.v1') throw new Error(`corrupt raw log schema in ${stream}`);
    const { receiptSha256, ...base } = envelope;
    if (envelope.sequence !== expectedSequence) throw new Error(`corrupt raw log sequence in ${stream}`);
    if (envelope.previousReceiptSha256 !== previousReceiptSha256) throw new Error(`raw log receipt chain mismatch in ${stream}`);
    if (canonicalSha256(envelope.record) !== envelope.recordSha256) throw new Error(`raw log record checksum mismatch in ${stream}`);
    if (canonicalSha256(base) !== receiptSha256) throw new Error(`raw log receipt checksum mismatch in ${stream}`);
    const frameEnd = payloadEnd + 1;
    frames.push({ frameStart, frameEnd, payloadLength, envelope: deepFreeze(envelope) });
    previousReceiptSha256 = receiptSha256;
    expectedSequence += 1;
    offset = frameEnd;
  }
  if (truncatedTail && !tolerateTruncatedTail) throw new Error(`truncated raw log tail in ${stream}`);
  return { frames, validBytes: offset, truncatedTail, lastReceiptSha256: previousReceiptSha256 };
}

export class DiskBackedRawLog {
  constructor({ rootDir, maxRecordBytes = 256 * 1024, maxReadBytes = 1024 * 1024, maxRecordsPerRead = 256, maxStreams = 10_000, maxDepth = 8, maxArray = 1_024, maxKeys = 2_048, maxString = 64 * 1024 } = {}) {
    this.rootDir = String(rootDir ?? '').trim();
    if (!this.rootDir) throw new TypeError('rootDir is required');
    this.maxRecordBytes = boundedInteger(maxRecordBytes, 256 * 1024, 64, 16 * 1024 * 1024, 'maxRecordBytes');
    this.maxReadBytes = boundedInteger(maxReadBytes, 1024 * 1024, 64, 64 * 1024 * 1024, 'maxReadBytes');
    this.maxRecordsPerRead = boundedInteger(maxRecordsPerRead, 256, 1, 10_000, 'maxRecordsPerRead');
    this.maxStreams = boundedInteger(maxStreams, 10_000, 1, 100_000, 'maxStreams');
    this.sanitizeLimits = { maxDepth, maxArray, maxKeys, maxString };
    this.streams = new Map();
    this.closed = false;
    mkdirSync(this.rootDir, { recursive: true });
    this.#recover();
  }

  append(streamValue, record) {
    if (this.closed) throw new Error('DiskBackedRawLog is closed');
    const id = streamId(streamValue);
    const redactedRecord = sanitize(record, this.sanitizeLimits);
    const recordBytes = Buffer.byteLength(canonicalStringify(redactedRecord));
    if (recordBytes > this.maxRecordBytes) throw new RangeError(`raw log record byte limit exceeded: ${recordBytes} > ${this.maxRecordBytes}`);
    let state = this.streams.get(id);
    if (!state) {
      if (this.streams.size >= this.maxStreams) throw new RangeError(`raw log stream capacity exceeded: ${this.maxStreams}`);
      state = { streamId: id, filePath: this.#path(id), recordCount: 0, byteLength: 0, validBytes: 0, lastReceiptSha256: null, truncatedTail: false };
      this.streams.set(id, state);
    }
    if (state.truncatedTail && existsSync(state.filePath)) {
      truncateSync(state.filePath, state.validBytes);
      state.byteLength = state.validBytes;
      state.truncatedTail = false;
    }
    const base = {
      schema: 'forge.disk-raw-log-record.v1', sequence: state.recordCount + 1,
      previousReceiptSha256: state.lastReceiptSha256, record: redactedRecord, recordSha256: canonicalSha256(redactedRecord),
    };
    const envelope = { ...base, receiptSha256: canonicalSha256(base) };
    const frame = encodeFrame(envelope);
    appendFileSync(state.filePath, frame);
    state.recordCount += 1; state.byteLength += frame.length; state.validBytes = state.byteLength; state.lastReceiptSha256 = envelope.receiptSha256;
    return deepFreeze({
      schema: 'forge.disk-raw-log-append.v1', streamId: id, sequence: envelope.sequence,
      offset: state.byteLength - frame.length, nextOffset: state.byteLength, recordBytes,
      receiptSha256: envelope.receiptSha256,
    });
  }

  read(streamValue, options = {}) {
    const id = streamId(streamValue);
    const state = this.streams.get(id);
    const offset = boundedInteger(options.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
    const maxRecords = boundedInteger(options.maxRecords, this.maxRecordsPerRead, 1, this.maxRecordsPerRead, 'maxRecords');
    const maxBytes = boundedInteger(options.maxBytes, this.maxReadBytes, 1, this.maxReadBytes, 'maxBytes');
    if (!state || !existsSync(state.filePath)) return signed({ schema: 'forge.disk-raw-log-read.v1', streamId: id, offset, nextOffset: offset, records: [], truncated: false, truncatedTail: false });
    const parsed = parseFrames(readFileSync(state.filePath), { stream: id });
    const candidates = parsed.frames.filter((frame) => frame.frameStart >= offset);
    const records = [];
    let usedRecordBytes = 0;
    let nextOffset = offset;
    for (const frame of candidates) {
      const bytes = Buffer.byteLength(canonicalStringify(frame.envelope.record));
      if (records.length >= maxRecords || (records.length > 0 && usedRecordBytes + bytes > maxBytes)) break;
      if (records.length === 0 && bytes > maxBytes) break;
      records.push(deepFreeze({
        sequence: frame.envelope.sequence, offset: frame.frameStart, nextOffset: frame.frameEnd,
        record: frame.envelope.record, recordSha256: frame.envelope.recordSha256, receiptSha256: frame.envelope.receiptSha256,
      }));
      usedRecordBytes += bytes; nextOffset = frame.frameEnd;
    }
    const remaining = candidates.some((frame) => frame.frameStart >= nextOffset);
    return signed({
      schema: 'forge.disk-raw-log-read.v1', streamId: id, offset, nextOffset, records,
      returnedRecordBytes: usedRecordBytes, truncated: remaining, truncatedTail: parsed.truncatedTail,
    });
  }

  snapshot(streamValue = null) {
    if (streamValue !== null && streamValue !== undefined) {
      const id = streamId(streamValue);
      const state = this.streams.get(id) ?? { streamId: id, recordCount: 0, byteLength: 0, validBytes: 0, lastReceiptSha256: null, truncatedTail: false };
      return signed({
        schema: 'forge.disk-raw-log-stream-snapshot.v1', streamId: id, recordCount: state.recordCount,
        byteLength: state.byteLength, validBytes: state.validBytes, lastReceiptSha256: state.lastReceiptSha256,
        truncatedTail: state.truncatedTail, closed: this.closed,
        claims: { rawRecordsStoredInMemory: false, rawPromptsStored: false, chainOfThoughtStored: false, credentialsStored: false },
      });
    }
    const streams = [...this.streams.values()].map((state) => Object.freeze({
      streamId: state.streamId, recordCount: state.recordCount, byteLength: state.byteLength,
      validBytes: state.validBytes, lastReceiptSha256: state.lastReceiptSha256, truncatedTail: state.truncatedTail,
    })).sort((a, b) => a.streamId.localeCompare(b.streamId));
    return signed({ schema: 'forge.disk-raw-log-snapshot.v1', streams, streamCount: streams.length, closed: this.closed, claims: { rawRecordsStoredInMemory: false } });
  }

  close() { this.closed = true; return this.snapshot(); }

  #path(id) { return join(this.rootDir, `${id}.frlog`); }

  #recover() {
    const names = readdirSync(this.rootDir).filter((name) => name.endsWith('.frlog')).sort();
    if (names.length > this.maxStreams) throw new RangeError(`raw log stream capacity exceeded: ${this.maxStreams}`);
    for (const name of names) {
      const id = streamId(name.slice(0, -6));
      const filePath = this.#path(id);
      const buffer = readFileSync(filePath);
      const parsed = parseFrames(buffer, { stream: id });
      this.streams.set(id, {
        streamId: id, filePath, recordCount: parsed.frames.length, byteLength: statSync(filePath).size,
        validBytes: parsed.validBytes, lastReceiptSha256: parsed.lastReceiptSha256, truncatedTail: parsed.truncatedTail,
      });
    }
  }
}
