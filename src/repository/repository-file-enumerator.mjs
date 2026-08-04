import { execFile } from 'node:child_process';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const execFileAsync = promisify(execFile);
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

function validateRelative(value) {
  const relative = normalize(value);
  if (!relative || path.posix.isAbsolute(relative) || relative === '..' || relative.startsWith('../') || relative.includes('/../')) return null;
  return relative;
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function safeRegularFile(root, rootReal, relative, skipDirs) {
  const normalized = validateRelative(relative);
  if (!normalized || normalized.split('/').some((part) => skipDirs.has(part))) return null;
  const absolute = path.join(root, normalized);
  let info;
  try { info = await lstat(absolute); } catch { return null; }
  if (!info.isFile() || info.isSymbolicLink()) return null;
  let resolved;
  try { resolved = await realpath(absolute); } catch { return null; }
  return inside(rootReal, resolved) ? normalized : null;
}

async function enumerateWithGit(root, rootReal, { maxFiles, skipDirs, timeoutMs }) {
  const { stdout } = await execFileAsync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'buffer',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  const candidates = [...new Set(stdout.toString('utf8').split('\0').filter(Boolean).map(normalize))].sort();
  const files = [];
  let skippedSymlinksOrEscapes = 0;
  for (const candidate of candidates) {
    if (files.length >= maxFiles) break;
    const safe = await safeRegularFile(root, rootReal, candidate, skipDirs);
    if (safe) files.push(safe); else skippedSymlinksOrEscapes += 1;
  }
  return { files, limited: candidates.length > files.length && files.length >= maxFiles, skippedSymlinksOrEscapes };
}

async function enumerateWithFilesystem(root, rootReal, { maxFiles, maxDepth, skipDirs }) {
  const files = [];
  let limited = false;
  let skippedSymlinksOrEscapes = 0;
  const visit = async (directory, depth) => {
    if (limited || depth > maxDepth) { limited = true; return; }
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= maxFiles) { limited = true; return; }
      if (skipDirs.has(entry.name) && entry.isDirectory()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) { skippedSymlinksOrEscapes += 1; continue; }
      if (entry.isDirectory()) {
        await visit(absolute, depth + 1);
        if (limited) return;
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = normalize(path.relative(root, absolute));
      const safe = await safeRegularFile(root, rootReal, relative, skipDirs);
      if (safe) files.push(safe); else skippedSymlinksOrEscapes += 1;
    }
  };
  await visit(root, 0);
  return { files: files.sort(), limited, skippedSymlinksOrEscapes };
}

export async function enumerateRepositoryFiles(root, {
  maxFiles = 20_000,
  maxDepth = 64,
  skipDirs = ['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '__pycache__'],
  gitTimeoutMs = 15_000,
} = {}) {
  const absoluteRoot = path.resolve(String(root ?? ''));
  const boundedMaxFiles = Number(maxFiles);
  const boundedMaxDepth = Number(maxDepth);
  if (!Number.isInteger(boundedMaxFiles) || boundedMaxFiles < 1 || boundedMaxFiles > 1_000_000) throw new TypeError('maxFiles must be between 1 and 1000000');
  if (!Number.isInteger(boundedMaxDepth) || boundedMaxDepth < 1 || boundedMaxDepth > 512) throw new TypeError('maxDepth must be between 1 and 512');
  const skip = new Set([...skipDirs].map(String));
  const rootReal = await realpath(absoluteRoot);
  let mode = 'git';
  let result;
  try {
    result = await enumerateWithGit(absoluteRoot, rootReal, { maxFiles: boundedMaxFiles, skipDirs: skip, timeoutMs: gitTimeoutMs });
  } catch {
    mode = 'filesystem-fallback';
    result = await enumerateWithFilesystem(absoluteRoot, rootReal, { maxFiles: boundedMaxFiles, maxDepth: boundedMaxDepth, skipDirs: skip });
  }
  const warnings = mode === 'filesystem-fallback' ? ['filesystem-fallback'] : [];
  const base = {
    schema: 'nolane.agent.repository-enumeration.v1',
    mode,
    files: result.files,
    limited: result.limited,
    warnings,
    skippedSymlinksOrEscapes: result.skippedSymlinksOrEscapes,
    claims: { gitMetadataRequired: false, symlinksFollowed: false, pathsConfinedToRoot: true },
  };
  return Object.freeze({
    ...base,
    files: Object.freeze([...base.files]),
    warnings: Object.freeze([...warnings]),
    claims: Object.freeze(base.claims),
    receiptSha256: canonicalSha256(base),
  });
}
