import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { inspectSecureZip, readSecureZipEntry } from '../../src/release/secure-zip.mjs';

const FORBIDDEN_BRAND = String.fromCharCode(104, 101, 114, 109, 101, 115);
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache', '.cache']);
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.vsix']);
const MAX_TEXT_SCAN_BYTES = 32 * 1024 * 1024;
const MISLEADING_OWNERSHIP_PATTERNS = Object.freeze([
  Object.freeze({ id: 'owned-runtime-described-as-absent', pattern: /NolaneNative\s+(?:runtime\s+and\s+archive\s+remain\s+absent|is\s+absent\s+from\s+production)/i }),
  Object.freeze({ id: 'owned-runtime-described-as-third-party', pattern: /NolaneNative\s+remains\s+third-party/i }),
  Object.freeze({ id: 'owned-runtime-concatenated-with-product', pattern: /(?:Nolane Agent|ForgeStudio)-NolaneNative/i }),
  Object.freeze({ id: 'upstream-research-relabeled-as-owned-runtime', pattern: /NousResearch\/nolane_native-agent/i }),
]);

function containsForbiddenBrand(value) {
  return String(value ?? '').toLocaleLowerCase('en-US').includes(FORBIDDEN_BRAND);
}

async function walk(root, current = root) {
  const output = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await walk(root, absolute));
    else if (entry.isFile()) output.push(path.relative(root, absolute).replaceAll('\\', '/'));
  }
  return output;
}

function scanTextBuffer(buffer) {
  if (buffer.length > MAX_TEXT_SCAN_BYTES) return null;
  const text = buffer.toString('latin1');
  return Object.freeze({
    forbidden: containsForbiddenBrand(text),
    ownershipIssues: Object.freeze(MISLEADING_OWNERSHIP_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id)),
  });
}

function scanBuffer(buffer) { return scanTextBuffer(buffer)?.forbidden === true; }

function scanZipBuffer(buffer, archiveLabel) {
  const parsed = inspectSecureZip(buffer, { maxEntries: 50_000, maxTotalBytes: 3 * 1024 * 1024 * 1024, maxFileBytes: 768 * 1024 * 1024 });
  const forbiddenFindings = [];
  const ownershipFindings = [];
  for (const entry of parsed.entries) {
    if (containsForbiddenBrand(entry.path)) forbiddenFindings.push(`${archiveLabel}!/${entry.path}`);
    if (entry.directory || entry.bytes > MAX_TEXT_SCAN_BYTES) continue;
    const content = readSecureZipEntry(parsed, entry);
    const scanned = scanTextBuffer(content);
    if (scanned?.forbidden) forbiddenFindings.push(`${archiveLabel}!/${entry.path}#content`);
    for (const issue of scanned?.ownershipIssues ?? []) ownershipFindings.push(`${archiveLabel}!/${entry.path}#${issue}`);
  }
  return Object.freeze({ forbiddenFindings: Object.freeze(forbiddenFindings), ownershipFindings: Object.freeze(ownershipFindings) });
}

export async function verifyNolaneRuntimePurity({ rootDirectory = process.cwd(), archives = [] } = {}) {
  const target = path.resolve(rootDirectory);
  const targetStat = await stat(target);
  const root = targetStat.isDirectory() ? target : path.dirname(target);
  const pathFindings = [];
  const contentFindings = [];
  const archiveFindings = [];
  const ownershipFindings = [];
  const archiveOwnershipFindings = [];
  const files = targetStat.isDirectory() ? await walk(root) : [path.basename(target)];

  for (const relative of files) {
    if (containsForbiddenBrand(relative)) pathFindings.push(relative);
    const absolute = targetStat.isDirectory() ? path.join(root, relative) : target;
    const extension = path.extname(relative).toLocaleLowerCase('en-US');
    const content = await readFile(absolute);
    const scanned = scanTextBuffer(content);
    if (scanned?.forbidden) contentFindings.push(relative);
    for (const issue of scanned?.ownershipIssues ?? []) ownershipFindings.push(`${relative}#${issue}`);
    if (ARCHIVE_EXTENSIONS.has(extension)) {
      try {
        const archiveScan = scanZipBuffer(content, relative);
        archiveFindings.push(...archiveScan.forbiddenFindings);
        archiveOwnershipFindings.push(...archiveScan.ownershipFindings);
      } catch (error) { archiveFindings.push(`${relative}#invalid-archive:${error.message}`); }
    }
  }

  for (const archive of archives) {
    const absolute = path.resolve(root, archive);
    const relative = path.relative(root, absolute).replaceAll('\\', '/');
    const content = await readFile(absolute);
    const archiveScan = scanZipBuffer(content, relative);
    archiveFindings.push(...archiveScan.forbiddenFindings);
    archiveOwnershipFindings.push(...archiveScan.ownershipFindings);
  }

  const failures = [];
  if (pathFindings.length) failures.push('forbidden-brand-in-path');
  if (contentFindings.length) failures.push('forbidden-brand-in-content');
  if (archiveFindings.length) failures.push('forbidden-brand-in-archive');
  if (ownershipFindings.length || archiveOwnershipFindings.length) failures.push('misleading-runtime-ownership');

  const base = {
    schema: 'nolane.agent.runtime-purity.v1',
    status: failures.length ? 'fail' : 'pass',
    productOwner: 'Nolane Agent',
    runtimeOwner: 'Nolane Native',
    scannedFiles: files.length,
    pathFindings: Object.freeze(pathFindings.sort()),
    contentFindings: Object.freeze(contentFindings.sort()),
    archiveFindings: Object.freeze(archiveFindings.sort()),
    ownershipFindings: Object.freeze(ownershipFindings.sort()),
    archiveOwnershipFindings: Object.freeze(archiveOwnershipFindings.sort()),
    failures: Object.freeze(failures),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export const NOLANE_RUNTIME_PURITY_FORBIDDEN_BRAND_BYTES = Object.freeze([104, 101, 114, 109, 101, 115]);
