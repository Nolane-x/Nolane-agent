import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { classifyArchiveEntry } from './archive-classifier.mjs';

const execFileAsync = promisify(execFile);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function freeze(value) {
  if (value && typeof value === 'object' && Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function assertSafeEntryPath(value) {
  const normalized = String(value).replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe archive path: ${value}`);
  }
  return normalized;
}

function archiveTypeFor(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.zip') || lower.endsWith('.vsix') || lower.endsWith('.whl')) return 'zip';
  if (/\.(?:tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz)$/.test(lower)) return 'tar';
  throw new TypeError(`Unsupported archive type: ${filePath}`);
}

const PYTHON_INSPECTOR = String.raw`
import sys,json,hashlib,zipfile,tarfile,stat
p=sys.argv[1]
t=sys.argv[2]
rows=[]
if t=='zip':
  with zipfile.ZipFile(p,'r') as z:
    for i in z.infolist():
      if i.is_dir():
        continue
      h=hashlib.sha256(); first=b''
      with z.open(i,'r') as f:
        while True:
          b=f.read(1024*1024)
          if not b: break
          if len(first)<32: first=(first+b)[:32]
          h.update(b)
      rows.append({'path':i.filename,'bytes':i.file_size,'compressedBytes':i.compress_size,'sha256':h.hexdigest(),'magic':first.hex(),'mode':oct((i.external_attr>>16)&0xffff)})
else:
  with tarfile.open(p,'r:*') as tf:
    for i in tf.getmembers():
      if not i.isfile():
        continue
      h=hashlib.sha256(); first=b''; f=tf.extractfile(i)
      if f:
        while True:
          b=f.read(1024*1024)
          if not b: break
          if len(first)<32: first=(first+b)[:32]
          h.update(b)
      rows.append({'path':i.name,'bytes':i.size,'compressedBytes':None,'sha256':h.hexdigest(),'magic':first.hex(),'mode':oct(i.mode)})
print(json.dumps(rows,separators=(',',':')))
`;

export async function decomposeArchive({ archivePath, expectedSha256 = null } = {}) {
  if (typeof archivePath !== 'string' || archivePath.length === 0) throw new TypeError('archivePath is required');
  if (expectedSha256 !== null && !SHA256_PATTERN.test(expectedSha256)) throw new TypeError('expectedSha256 must be a lowercase SHA-256');
  const absolutePath = path.resolve(archivePath);
  const archiveBytes = await readFile(absolutePath);
  const archiveSha256 = createHash('sha256').update(archiveBytes).digest('hex');
  if (expectedSha256 && expectedSha256 !== archiveSha256) throw new Error(`Archive SHA-256 mismatch: expected ${expectedSha256} actual ${archiveSha256}`);
  const archiveType = archiveTypeFor(absolutePath);
  const { stdout } = await execFileAsync('python3', ['-c', PYTHON_INSPECTOR, absolutePath, archiveType], { maxBuffer: 256 * 1024 * 1024 });
  const rawEntries = JSON.parse(stdout);
  const entries = rawEntries.map((raw) => {
    const safePath = assertSafeEntryPath(raw.path);
    const classification = classifyArchiveEntry({ path: safePath, bytes: raw.bytes, magic: raw.magic, mode: raw.mode });
    return freeze({ ...raw, path: safePath, category: classification.category, classificationReason: classification.reason });
  }).sort((a, b) => a.path.localeCompare(b.path));

  const categoryTotals = {};
  for (const entry of entries) {
    categoryTotals[entry.category] ??= { entries: 0, uncompressedBytes: 0, compressedBytes: 0 };
    categoryTotals[entry.category].entries += 1;
    categoryTotals[entry.category].uncompressedBytes += Number(entry.bytes ?? 0);
    categoryTotals[entry.category].compressedBytes += Number(entry.compressedBytes ?? 0);
  }
  const hashes = new Map();
  for (const entry of entries) {
    const values = hashes.get(entry.sha256) ?? [];
    values.push(entry.path);
    hashes.set(entry.sha256, values);
  }
  const duplicateGroups = [...hashes.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256, paths]) => freeze({ sha256, paths: [...paths].sort() }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
  const totals = {
    archiveBytes: archiveBytes.byteLength,
    uncompressedBytes: entries.reduce((sum, entry) => sum + Number(entry.bytes ?? 0), 0),
    compressedBytes: entries.reduce((sum, entry) => sum + Number(entry.compressedBytes ?? 0), 0),
  };
  return freeze({
    schema: 'nolane.forensics.archive-decomposition.v1',
    archivePath: absolutePath,
    archiveType,
    archiveSha256,
    entries,
    categoryTotals,
    duplicateGroups,
    nestedArchives: entries.filter((entry) => entry.category === 'nested-archive'),
    unknownEntries: entries.filter((entry) => entry.category === 'unknown'),
    totals,
  });
}
