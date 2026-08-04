import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 30_000,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  maxFileBytes: 512 * 1024 * 1024,
});

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function normalizeEntryPath(value) {
  const raw = String(value ?? '').replaceAll('\\', '/');
  const parts = raw.split('/').filter(Boolean);
  if (!raw || raw.startsWith('/') || /^[A-Za-z]:\//.test(raw) || parts.includes('..') || raw.includes('\0')) {
    throw new Error(`Unsafe ZIP path: ${value}`);
  }
  return raw;
}

function commonPrefix(entries) {
  const first = entries[0]?.path.split('/')[0];
  if (!first) return '';
  return entries.every((entry) => entry.path === first || entry.path.startsWith(`${first}/`)) ? `${first}/` : '';
}

export function inspectSecureZip(buffer, limits = {}) {
  const data = Buffer.from(buffer);
  const policy = { ...DEFAULT_LIMITS, ...limits };
  const minimum = Math.max(0, data.length - 65_557);
  let eocd = -1;
  for (let offset = data.length - 22; offset >= minimum; offset -= 1) {
    if (data.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record is missing');
  const disk = data.readUInt16LE(eocd + 4);
  const centralDisk = data.readUInt16LE(eocd + 6);
  const countOnDisk = data.readUInt16LE(eocd + 8);
  const count = data.readUInt16LE(eocd + 10);
  const size = data.readUInt32LE(eocd + 12);
  const start = data.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || count !== countOnDisk) throw new Error('Multi-disk ZIP archives are not allowed');
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff) throw new Error('ZIP64 archives are not supported by the clean-room verifier');
  if (count > policy.maxEntries || start + size > data.length) throw new Error('ZIP central directory is invalid');

  const entries = [];
  const seen = new Set();
  let cursor = start;
  let totalBytes = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP central directory entry is invalid');
    const flags = data.readUInt16LE(cursor + 8);
    const method = data.readUInt16LE(cursor + 10);
    const checksum = data.readUInt32LE(cursor + 16) >>> 0;
    const compressedBytes = data.readUInt32LE(cursor + 20);
    const bytes = data.readUInt32LE(cursor + 24);
    const nameBytes = data.readUInt16LE(cursor + 28);
    const extraBytes = data.readUInt16LE(cursor + 30);
    const commentBytes = data.readUInt16LE(cursor + 32);
    const external = data.readUInt32LE(cursor + 38);
    const localOffset = data.readUInt32LE(cursor + 42);
    const end = cursor + 46 + nameBytes + extraBytes + commentBytes;
    if (end > data.length || (flags & 0x1)) throw new Error('Encrypted or truncated ZIP entries are not allowed');
    if (![0, 8].includes(method)) throw new Error(`Unsupported ZIP compression method ${method}`);
    const rawName = data.subarray(cursor + 46, cursor + 46 + nameBytes).toString((flags & 0x800) ? 'utf8' : 'latin1');
    const entryPath = normalizeEntryPath(rawName);
    if (seen.has(entryPath)) throw new Error(`Duplicate ZIP path: ${entryPath}`);
    seen.add(entryPath);
    const unixMode = external >>> 16;
    if ((unixMode & 0o170000) === 0o120000) throw new Error(`ZIP symlink entries are not allowed: ${entryPath}`);
    if (bytes > policy.maxFileBytes) throw new Error(`ZIP entry exceeds ${policy.maxFileBytes} bytes: ${entryPath}`);
    totalBytes += bytes;
    if (totalBytes > policy.maxTotalBytes) throw new Error(`ZIP output exceeds ${policy.maxTotalBytes} bytes`);
    entries.push(Object.freeze({ path: entryPath, directory: entryPath.endsWith('/'), flags, method, checksum, compressedBytes, bytes, localOffset, unixMode }));
    cursor = end;
  }
  if (cursor !== start + size) throw new Error('ZIP central directory size mismatch');
  return Object.freeze({ data, entries: Object.freeze(entries), totalBytes, prefix: commonPrefix(entries) });
}

export function readSecureZipEntry(parsed, entry) {
  if (entry.directory) return Buffer.alloc(0);
  const offset = entry.localOffset;
  if (offset + 30 > parsed.data.length || parsed.data.readUInt32LE(offset) !== 0x04034b50) throw new Error(`ZIP local header is invalid: ${entry.path}`);
  const localFlags = parsed.data.readUInt16LE(offset + 6);
  const localMethod = parsed.data.readUInt16LE(offset + 8);
  const nameBytes = parsed.data.readUInt16LE(offset + 26);
  const extraBytes = parsed.data.readUInt16LE(offset + 28);
  if ((localFlags & 0x1) || localMethod !== entry.method) throw new Error(`ZIP local header conflicts with central directory: ${entry.path}`);
  const start = offset + 30 + nameBytes + extraBytes;
  const end = start + entry.compressedBytes;
  if (end > parsed.data.length) throw new Error(`ZIP compressed data exceeds archive bounds: ${entry.path}`);
  const compressed = parsed.data.subarray(start, end);
  const output = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.bytes) });
  if (output.length !== entry.bytes) throw new Error(`ZIP decompression size mismatch: ${entry.path}`);
  if (crc32(output) !== entry.checksum) throw new Error(`ZIP CRC-32 mismatch: ${entry.path}`);
  return output;
}

export async function extractSecureZip(parsed, destination, { stripPrefix = parsed.prefix } = {}) {
  const root = path.resolve(destination);
  await mkdir(root, { recursive: true });
  for (const entry of parsed.entries) {
    const relative = stripPrefix && entry.path.startsWith(stripPrefix) ? entry.path.slice(stripPrefix.length) : entry.path;
    if (!relative) continue;
    const target = path.resolve(root, relative);
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Unsafe ZIP extraction path: ${entry.path}`);
    if (entry.directory) { await mkdir(target, { recursive: true }); continue; }
    const content = readSecureZipEntry(parsed, entry);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { mode: entry.unixMode & 0o111 ? 0o755 : 0o644 });
  }
  return root;
}

export function secureZipSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
