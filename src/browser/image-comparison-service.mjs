import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function codedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const payload = Buffer.from(data);
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  name.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, payload])), 8 + payload.length);
  return chunk;
}

function positiveInteger(value, label, max = 100_000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw codedError('IMAGE_DIMENSION_INVALID', `${label} must be between 1 and ${max}`);
  return number;
}

export function encodeRgbaPng({ width, height, data, maxPixels = 100_000_000 } = {}) {
  const w = positiveInteger(width, 'width');
  const h = positiveInteger(height, 'height');
  if (w * h > Number(maxPixels)) throw codedError('IMAGE_PIXEL_LIMIT', `Image exceeds ${maxPixels} pixels`);
  const pixels = Buffer.from(data ?? []);
  if (pixels.length !== w * h * 4) throw codedError('IMAGE_DATA_INVALID', `RGBA data must contain ${w * h * 4} bytes`);
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let row = 0; row < h; row += 1) {
    const target = row * (1 + w * 4);
    raw[target] = 0;
    pixels.copy(raw, target + 1, row * w * 4, (row + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buffer, maxPixels) {
  if (!Buffer.from(buffer).subarray(0, 8).equals(PNG_SIGNATURE)) throw codedError('IMAGE_FORMAT_INVALID', 'Invalid PNG signature');
  let offset = 8;
  let width = null;
  let height = null;
  let bitDepth = null;
  let colorType = null;
  let interlace = null;
  const idat = [];
  let sawEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw codedError('IMAGE_FORMAT_INVALID', 'PNG chunk exceeds file length');
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) throw codedError('IMAGE_FORMAT_INVALID', `PNG ${type} checksum mismatch`);
    if (type === 'IHDR') {
      if (length !== 13 || width !== null) throw codedError('IMAGE_FORMAT_INVALID', 'Invalid PNG IHDR');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0) throw codedError('IMAGE_FORMAT_INVALID', 'Unsupported PNG compression or filter method');
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') { sawEnd = true; break; }
    offset = end;
  }
  if (!sawEnd || width === null || height === null || idat.length === 0) throw codedError('IMAGE_FORMAT_INVALID', 'PNG is missing required chunks');
  positiveInteger(width, 'width');
  positiveInteger(height, 'height');
  if (width * height > maxPixels) throw codedError('IMAGE_PIXEL_LIMIT', `Image exceeds ${maxPixels} pixels`);
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) throw codedError('IMAGE_FORMAT_UNSUPPORTED', 'Built-in PNG backend supports non-interlaced 8-bit RGB/RGBA images');
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  let inflated;
  try { inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: height * (stride + 1) }); }
  catch (error) { throw codedError('IMAGE_FORMAT_INVALID', `PNG decompression failed: ${error.message}`); }
  if (inflated.length !== height * (stride + 1)) throw codedError('IMAGE_FORMAT_INVALID', 'PNG pixel stream length mismatch');
  const decoded = Buffer.alloc(width * height * channels);
  for (let row = 0; row < height; row += 1) {
    const inputStart = row * (stride + 1);
    const filter = inflated[inputStart];
    const outputStart = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[inputStart + 1 + column];
      const left = column >= channels ? decoded[outputStart + column - channels] : 0;
      const up = row > 0 ? decoded[outputStart + column - stride] : 0;
      const upperLeft = row > 0 && column >= channels ? decoded[outputStart + column - stride - channels] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = (raw + left) & 0xff;
      else if (filter === 2) value = (raw + up) & 0xff;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) value = (raw + paeth(left, up, upperLeft)) & 0xff;
      else throw codedError('IMAGE_FORMAT_INVALID', `Unsupported PNG filter ${filter}`);
      decoded[outputStart + column] = value;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0, output = 0; index < decoded.length; index += channels, output += 4) {
    rgba[output] = decoded[index];
    rgba[output + 1] = decoded[index + 1];
    rgba[output + 2] = decoded[index + 2];
    rgba[output + 3] = channels === 4 ? decoded[index + 3] : 255;
  }
  return Object.freeze({ width, height, data: rgba, format: 'png' });
}

function formatOf(buffer) {
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

export class ImageComparisonService {
  constructor({ workspaceRoot, artifactRoot, backend = null, maxImageBytes = 20_000_000, maxPixels = 25_000_000 } = {}) {
    this.workspaceRoot = path.resolve(String(workspaceRoot ?? ''));
    this.artifactRoot = path.resolve(String(artifactRoot ?? path.join(this.workspaceRoot, '.forge-studio', 'artifacts')));
    this.backend = backend;
    this.maxImageBytes = Number(maxImageBytes);
    this.maxPixels = Number(maxPixels);
    if (!Number.isInteger(this.maxImageBytes) || this.maxImageBytes < 64 || this.maxImageBytes > 500_000_000) throw new TypeError('maxImageBytes must be between 64 and 500000000');
    if (!Number.isInteger(this.maxPixels) || this.maxPixels < 1 || this.maxPixels > 100_000_000) throw new TypeError('maxPixels must be between 1 and 100000000');
    this.#assertContained(this.artifactRoot, 'IMAGE_ARTIFACT_PATH_DENIED');
  }

  #assertContained(absolute, code = 'IMAGE_PATH_DENIED') {
    const relative = path.relative(this.workspaceRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw codedError(code, 'Image path is outside the workspace');
    return relative.split(path.sep).join('/');
  }

  async #load(relativePath) {
    const absolute = path.resolve(this.workspaceRoot, String(relativePath ?? ''));
    this.#assertContained(absolute);
    const info = await stat(absolute).catch(() => null);
    if (!info || !info.isFile()) throw codedError('IMAGE_NOT_FOUND', `Image is not a regular file: ${relativePath}`);
    if (info.size > this.maxImageBytes) throw codedError('IMAGE_TOO_LARGE', `Image exceeds ${this.maxImageBytes} bytes`);
    const buffer = await readFile(absolute);
    const format = formatOf(buffer);
    if (!format) throw codedError('IMAGE_FORMAT_INVALID', 'Unsupported or invalid image signature');
    let decoded;
    if (format === 'png') decoded = decodePng(buffer, this.maxPixels);
    else {
      if (!this.backend || typeof this.backend.decode !== 'function') throw codedError('IMAGE_BACKEND_UNAVAILABLE', `No optional backend is available for ${format}`);
      decoded = await this.backend.decode(buffer, { format, maxPixels: this.maxPixels });
      if (!decoded || !Number.isInteger(decoded.width) || !Number.isInteger(decoded.height) || !decoded.data) throw codedError('IMAGE_BACKEND_INVALID', 'Image backend returned an invalid result');
      if (decoded.width * decoded.height > this.maxPixels) throw codedError('IMAGE_PIXEL_LIMIT', `Image exceeds ${this.maxPixels} pixels`);
    }
    return Object.freeze({ absolute, relative: this.#assertContained(absolute), buffer, decoded });
  }

  async inspect({ path: relativePath } = {}) {
    const loaded = await this.#load(relativePath);
    const base = Object.freeze({ relativePath: loaded.relative, format: loaded.decoded.format ?? formatOf(loaded.buffer), width: loaded.decoded.width, height: loaded.decoded.height, bytes: loaded.buffer.length, contentSha256: sha256(loaded.buffer) });
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async read({ path: relativePath } = {}) {
    const loaded = await this.#load(relativePath);
    const format = loaded.decoded.format ?? formatOf(loaded.buffer);
    return Object.freeze({ relativePath: loaded.relative, format, mimeType: format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp', buffer: Buffer.from(loaded.buffer), contentSha256: sha256(loaded.buffer) });
  }

  async compare({ baselinePath, actualPath, threshold = 0, outputName = 'visual-diff.png' } = {}) {
    const numericThreshold = Number(threshold);
    if (!Number.isInteger(numericThreshold) || numericThreshold < 0 || numericThreshold > 255) throw codedError('IMAGE_THRESHOLD_INVALID', 'threshold must be an integer between 0 and 255');
    const safeName = path.basename(String(outputName ?? ''));
    if (!safeName || safeName !== String(outputName) || !safeName.toLowerCase().endsWith('.png')) throw codedError('IMAGE_ARTIFACT_NAME_INVALID', 'outputName must be a PNG file name without directories');
    const [baseline, actual] = await Promise.all([this.#load(baselinePath), this.#load(actualPath)]);
    if (baseline.decoded.width !== actual.decoded.width || baseline.decoded.height !== actual.decoded.height) {
      throw codedError('IMAGE_DIMENSION_MISMATCH', 'Images must have identical dimensions', { baseline: { width: baseline.decoded.width, height: baseline.decoded.height }, actual: { width: actual.decoded.width, height: actual.decoded.height } });
    }
    const { width, height } = baseline.decoded;
    const totalPixels = width * height;
    const diff = Buffer.alloc(totalPixels * 4);
    let changedPixels = 0;
    let absoluteDifference = 0;
    let maxChannelDifference = 0;
    for (let pixel = 0; pixel < totalPixels; pixel += 1) {
      const offset = pixel * 4;
      let changed = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(baseline.decoded.data[offset + channel] - actual.decoded.data[offset + channel]);
        absoluteDifference += delta;
        maxChannelDifference = Math.max(maxChannelDifference, delta);
        if (delta > numericThreshold) changed = true;
      }
      if (changed) {
        changedPixels += 1;
        diff[offset] = 255; diff[offset + 1] = 0; diff[offset + 2] = 0; diff[offset + 3] = 255;
      } else {
        const luminance = Math.round((actual.decoded.data[offset] + actual.decoded.data[offset + 1] + actual.decoded.data[offset + 2]) / 3);
        diff[offset] = luminance; diff[offset + 1] = luminance; diff[offset + 2] = luminance; diff[offset + 3] = 80;
      }
    }
    const diffPng = encodeRgbaPng({ width, height, data: diff, maxPixels: this.maxPixels });
    await mkdir(this.artifactRoot, { recursive: true });
    const artifact = path.join(this.artifactRoot, safeName);
    await writeFile(artifact, diffPng, { flag: 'w' });
    const base = {
      schema: 'forge.image-comparison.v1',
      baselinePath: baseline.relative,
      actualPath: actual.relative,
      baselineSha256: sha256(baseline.buffer),
      actualSha256: sha256(actual.buffer),
      diffSha256: sha256(diffPng),
      diffArtifact: this.#assertContained(artifact, 'IMAGE_ARTIFACT_PATH_DENIED'),
      width,
      height,
      totalPixels,
      changedPixels,
      changedPixelRatio: totalPixels === 0 ? 0 : changedPixels / totalPixels,
      meanAbsoluteChannelDifference: absoluteDifference / (totalPixels * 4),
      maxChannelDifference,
      threshold: numericThreshold,
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
