import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function assertSafeRelativePath(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('Source custody path is required');
  const normalized = value.replaceAll('\\', '/');
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:\//.test(normalized) || normalized.split('/').includes('..')) {
    throw new TypeError('Source custody path must be a safe relative path');
  }
  return normalized;
}

export function createSourceCustodyRecord({
  id,
  kind,
  path: recordPath,
  expectedSha256 = null,
  expectedBytes = null,
  origin,
  required = false,
  description = null,
} = {}) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new TypeError('Source custody id must be kebab-case');
  if (typeof kind !== 'string' || kind.trim() === '') throw new TypeError('Source custody kind is required');
  if (typeof origin !== 'string' || origin.trim() === '') throw new TypeError('Source custody origin is required');
  if (expectedSha256 !== null && !SHA256_PATTERN.test(expectedSha256)) throw new TypeError('expectedSha256 must be a lowercase SHA-256');
  if (expectedBytes !== null && (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0)) throw new TypeError('expectedBytes must be a non-negative safe integer');
  return freeze({
    schema: 'nolane.forensics.source-custody-record.v1',
    id,
    kind,
    path: assertSafeRelativePath(recordPath),
    expectedSha256,
    expectedBytes,
    origin,
    required: required === true,
    description,
  });
}

function missingBlocker(record) {
  if (!record.required) return null;
  if (record.kind === 'upstream-source') return `Canonical upstream source is unavailable for ${record.id}`;
  return `Required custody source is unavailable for ${record.id}`;
}

export async function verifySourceCustodyRecord(record, { root = process.cwd() } = {}) {
  const validated = createSourceCustodyRecord(record);
  const absolutePath = path.resolve(root, validated.path);
  const safeRoot = path.resolve(root);
  if (absolutePath !== safeRoot && !absolutePath.startsWith(`${safeRoot}${path.sep}`)) throw new TypeError('Resolved custody path escapes root');

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return freeze({ ...validated, status: 'missing', actualSha256: null, actualBytes: null, blocker: missingBlocker(validated) });
  }

  if (!fileStat.isFile()) {
    return freeze({ ...validated, status: 'not-a-file', actualSha256: null, actualBytes: fileStat.size, blocker: validated.required ? `Required custody path is not a file for ${validated.id}` : null });
  }

  const bytes = await readFile(absolutePath);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  const sizeMatches = validated.expectedBytes === null || validated.expectedBytes === bytes.byteLength;
  const hashMatches = validated.expectedSha256 === null || validated.expectedSha256 === actualSha256;
  if (!sizeMatches || !hashMatches) {
    const differences = [];
    if (!sizeMatches) differences.push(`bytes expected ${validated.expectedBytes} actual ${bytes.byteLength}`);
    if (!hashMatches) differences.push(`sha256 expected ${validated.expectedSha256} actual ${actualSha256}`);
    return freeze({ ...validated, status: 'mismatch', actualSha256, actualBytes: bytes.byteLength, blocker: `Custody mismatch for ${validated.id}: ${differences.join('; ')}` });
  }
  return freeze({ ...validated, status: 'verified', actualSha256, actualBytes: bytes.byteLength, blocker: null });
}
