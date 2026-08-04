import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { extractSecureZip, inspectSecureZip, readSecureZipEntry, secureZipSha256 } from './secure-zip.mjs';
import { verifyNolaneRuntimePurity } from '../../scripts/lib/nolane-runtime-purity-verifier.mjs';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/;

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function normalize(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function assertIdentity({ packageMetadata, lock, identity, manifest, expectedVersion, expectedProduct }) {
  if (packageMetadata.name !== 'nolane-agent' || packageMetadata.version !== expectedVersion || packageMetadata.productName !== expectedProduct) throw new Error('Clean-room package identity is invalid');
  if (lock.name !== packageMetadata.name || lock.version !== expectedVersion || lock.lockfileVersion !== 3 || lock.packages?.['']?.name !== packageMetadata.name || lock.packages?.['']?.version !== expectedVersion) throw new Error('Clean-room package lock identity is invalid');
  if (identity.schema !== 'nolane.agent.product-identity.v1' || identity.product !== expectedProduct || identity.packageName !== packageMetadata.name || identity.version !== expectedVersion) throw new Error('Clean-room product identity is invalid');
  if (manifest.schema !== 'nolane.agent.project-manifest.v1' || manifest.product !== expectedProduct || manifest.version !== expectedVersion || !Array.isArray(manifest.files)) throw new Error('Clean-room project manifest is invalid');
}

async function defaultRunCommand({ command, args, cwd, env, timeoutMs }) {
  try {
    const result = await execFileAsync(command, args, { cwd, env, timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    return { exitCode: 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } catch (error) {
    return { exitCode: Number.isInteger(error.code) ? error.code : 1, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message ?? '' };
  }
}

export async function certifyPublishedSourceArchive({
  archivePath,
  expectedVersion,
  expectedProduct = 'Nolane Agent',
  probes = [],
  runCommand = defaultRunCommand,
  timeoutMs = 20 * 60_000,
  keepExtracted = false,
} = {}) {
  if (!archivePath) throw new TypeError('archivePath is required');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(expectedVersion ?? ''))) throw new TypeError('expectedVersion must be semantic version');
  const absoluteArchive = path.resolve(archivePath);
  const archive = await readFile(absoluteArchive);
  const archiveSha256 = secureZipSha256(archive);
  const archiveInfo = await stat(absoluteArchive);
  const parsed = inspectSecureZip(archive);
  if (!parsed.prefix) throw new Error('Clean-room source ZIP must contain exactly one top-level source root');
  const sourceRoot = parsed.prefix.slice(0, -1);
  const byRelative = new Map();
  for (const entry of parsed.entries) {
    if (!entry.path.startsWith(parsed.prefix)) throw new Error('Clean-room source ZIP contains multiple top-level roots');
    const relative = normalize(entry.path.slice(parsed.prefix.length));
    if (!relative) continue;
    const parts = relative.split('/').filter(Boolean);
    if (parts.includes('.git')) throw new Error(`Clean-room source ZIP contains Git metadata: ${relative}`);
    if (parts.includes('node_modules')) throw new Error(`Clean-room source ZIP contains node_modules: ${relative}`);
    if (parts[0] === 'release') throw new Error(`Clean-room source ZIP contains release output: ${relative}`);
    if (relative === 'vendor/nolane_native-agent.manifest.json' || relative.startsWith('vendor/nolane_native-agent/') || relative.startsWith('src/nolane_native/')) {
      throw new Error(`NolaneNative runtime path is forbidden after retirement: ${relative}`);
    }
    byRelative.set(relative, entry);
  }
  for (const required of ['package.json', 'package-lock.json', 'project-manifest.json', 'config/product-identity.json', 'src/app.mjs', 'THIRD_PARTY_NOTICES.md']) {
    if (!byRelative.has(required)) throw new Error(`Clean-room source ZIP is missing ${required}`);
  }
  const readJson = (relative) => JSON.parse(readSecureZipEntry(parsed, byRelative.get(relative)).toString('utf8'));
  const packageMetadata = readJson('package.json');
  const lock = readJson('package-lock.json');
  const identity = readJson('config/product-identity.json');
  const manifest = readJson('project-manifest.json');
  assertIdentity({ packageMetadata, lock, identity, manifest, expectedVersion: String(expectedVersion), expectedProduct: String(expectedProduct) });

  const seenManifestPaths = new Set();
  for (const raw of manifest.files) {
    const relative = normalize(raw.relativePath);
    if (!relative || relative.startsWith('../') || path.isAbsolute(relative) || seenManifestPaths.has(relative)) throw new Error(`Clean-room manifest path is invalid: ${relative}`);
    seenManifestPaths.add(relative);
    const entry = byRelative.get(relative);
    if (!entry || entry.directory) throw new Error(`Clean-room manifest file is missing from ZIP: ${relative}`);
    const content = readSecureZipEntry(parsed, entry);
    if (content.length !== Number(raw.bytes)) throw new Error(`Clean-room manifest byte count mismatch: ${relative}`);
    if (!SHA256.test(String(raw.sha256 ?? '')) || digest(content) !== String(raw.sha256)) throw new Error(`Clean-room manifest SHA-256 mismatch: ${relative}`);
  }
  const forbiddenManifestPaths = [...seenManifestPaths].filter((relative) => relative === 'vendor/nolane_native-agent.manifest.json' || relative.startsWith('vendor/nolane_native-agent/') || relative.startsWith('src/nolane_native/'));
  if (forbiddenManifestPaths.length > 0) throw new Error(`NolaneNative runtime path is forbidden after retirement: ${forbiddenManifestPaths[0]}`);

  const temporary = path.join(os.tmpdir(), `nolane-clean-room-certification-${archiveSha256}`);
  const cacheHold = `${temporary}.cache-${process.pid}`;
  try {
    await rename(path.join(temporary, 'release', '.cache'), cacheHold);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  let extractedRoot = null;
  let completed = false;
  try {
    extractedRoot = await extractSecureZip(parsed, temporary, { stripPrefix: parsed.prefix });
    try {
      await mkdir(path.join(extractedRoot, 'release'), { recursive: true });
      await rename(cacheHold, path.join(extractedRoot, 'release', '.cache'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const runtimePurity = await verifyNolaneRuntimePurity({ rootDirectory: extractedRoot });
    if (runtimePurity.status !== 'pass') throw new Error(`Clean-room source runtime purity failed: ${runtimePurity.failures.join(', ')}`);
    const results = [];
    for (const [index, raw] of probes.entries()) {
      const id = String(raw.id ?? `probe-${index + 1}`);
      const command = String(raw.command ?? process.execPath);
      const args = Array.isArray(raw.args) ? raw.args.map(String) : [];
      const result = await runCommand({
        id, command, args, cwd: extractedRoot,
        env: { ...process.env, ...raw.env, NOLANE_AGENT_CLEAN_ROOM: '1', NOLANE_AGENT_SOURCE_ARCHIVE_SHA256: archiveSha256 },
        timeoutMs: Number(raw.timeoutMs ?? timeoutMs),
      });
      const exitCode = Number(result?.exitCode ?? 1);
      const stdout = Buffer.from(String(result?.stdout ?? ''));
      const stderr = Buffer.from(String(result?.stderr ?? ''));
      const record = Object.freeze({ id, status: exitCode === 0 ? 'pass' : 'fail', exitCode, stdoutBytes: stdout.length, stdoutSha256: digest(stdout), stderrBytes: stderr.length, stderrSha256: digest(stderr) });
      results.push(record);
      if (exitCode !== 0) throw new Error(`Clean-room probe failed: ${id} (exit ${exitCode})`);
    }
    const base = {
      schema: 'nolane.agent.clean-room-certification.v1', status: 'pass', product: expectedProduct, version: expectedVersion,
      archive: path.basename(absoluteArchive), archiveBytes: archiveInfo.size, archiveSha256, sourceRoot,
      entries: parsed.entries.length, extractedBytes: parsed.totalBytes, manifestFilesVerified: seenManifestPaths.size, runtimePurityReceiptSha256: runtimePurity.receiptSha256,
      runtimeOwnership: { product: 'Nolane Agent', runtime: 'nolane-native', externalRuntimeBundled: false, externalExecutablePaths: 0, attributionRetained: byRelative.has('THIRD_PARTY_NOTICES.md') }, probes: results,
    };
    completed = true;
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base), extractedRoot: keepExtracted ? extractedRoot : undefined });
  } finally {
    await rm(cacheHold, { recursive: true, force: true });
    if (completed && !keepExtracted) await rm(temporary, { recursive: true, force: true });
  }
}
