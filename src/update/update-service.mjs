import { createHash, randomUUID, verify } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './canonical-json.mjs';
import { isAllowedGitHubRedirect, requireRepository, validateGitHubReleaseManifestFields, validateManifestEndpoint } from './github-release-policy.mjs';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
function parseVersion(value) { const match = String(value ?? '').match(SEMVER); if (!match) throw new TypeError(`Invalid semantic version: ${value}`); return { raw: match[0], major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? null }; }
function compareVersion(left, right) { const a = parseVersion(left); const b = parseVersion(right); for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1; if (a.prerelease === b.prerelease) return 0; if (a.prerelease === null) return 1; if (b.prerelease === null) return -1; return a.prerelease.localeCompare(b.prerelease, 'en', { numeric: true }); }
function unsignedManifest(manifest) { const { signature: _signature, ...unsigned } = manifest ?? {}; return unsigned; }
function safeHttps(value, label) { const url = new URL(String(value ?? '')); if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS`); return url; }
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

export function inspectZipEntries(buffer) {
  const data = Buffer.from(buffer);
  const minimum = Math.max(0, data.length - 65_557); let eocd = -1;
  for (let offset = data.length - 22; offset >= minimum; offset -= 1) { if (data.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; } }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record is missing');
  const count = data.readUInt16LE(eocd + 10); const size = data.readUInt32LE(eocd + 12); const start = data.readUInt32LE(eocd + 16);
  if (start + size > data.length || count > 100_000) throw new Error('ZIP central directory is invalid');
  const entries = []; let cursor = start;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP central directory entry is invalid');
    const flags = data.readUInt16LE(cursor + 8); const fileNameBytes = data.readUInt16LE(cursor + 28); const extraBytes = data.readUInt16LE(cursor + 30); const commentBytes = data.readUInt16LE(cursor + 32); const externalAttributes = data.readUInt32LE(cursor + 38);
    if (flags & 0x1) throw new Error('Encrypted ZIP entries are not allowed');
    const end = cursor + 46 + fileNameBytes + extraBytes + commentBytes; if (end > data.length) throw new Error('ZIP entry exceeds archive bounds');
    const rawName = data.subarray(cursor + 46, cursor + 46 + fileNameBytes).toString((flags & 0x800) ? 'utf8' : 'latin1'); const name = rawName.replaceAll('\\', '/');
    const parts = name.split('/').filter(Boolean);
    if (!name || name.startsWith('/') || /^[A-Za-z]:\//.test(name) || parts.includes('..') || name.includes('\0')) throw new Error(`Unsafe ZIP path: ${rawName}`);
    const unixMode = externalAttributes >>> 16; if ((unixMode & 0o170000) === 0o120000) throw new Error(`ZIP symlink entries are not allowed: ${rawName}`);
    entries.push(Object.freeze({ path: name, directory: name.endsWith('/') })); cursor = end;
  }
  if (cursor > start + size) throw new Error('ZIP central directory size mismatch');
  return Object.freeze(entries);
}

async function fetchWithControlledRedirects(fetchImpl, input, options = {}, maxRedirects = 4) {
  let current = String(input);
  for (let index = 0; index <= maxRedirects; index += 1) {
    const response = await fetchImpl(current, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || !isAllowedGitHubRedirect(current, location)) throw new Error('Update redirect is outside the approved GitHub hosts');
    current = new URL(location, current).href;
  }
  throw new Error('Update redirect limit exceeded');
}

async function streamDownloadToFile(fetchImpl, url, {
  destination,
  maxBytes,
  expectedBytes,
  signal = null,
  onProgress = null,
} = {}) {
  const response = await fetchWithControlledRedirects(fetchImpl, url, {
    headers: { accept: 'application/zip, application/octet-stream' },
    signal,
  });
  if (!response.ok) throw new Error(`Update package HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error(`Update package exceeds ${maxBytes} byte limit`);
  if (declared > 0 && Number.isSafeInteger(expectedBytes) && declared !== expectedBytes) {
    throw new Error(`Update package byte count mismatch: expected ${expectedBytes}, got declared ${declared}`);
  }

  const hash = createHash('sha256');
  const header = Buffer.alloc(2);
  let headerBytes = 0;
  let total = 0;
  let handle = null;
  const report = () => {
    if (typeof onProgress !== 'function') return;
    onProgress(Object.freeze({
      downloadedBytes: total,
      totalBytes: expectedBytes,
      progress: expectedBytes > 0 ? Math.min(1, total / expectedBytes) : null,
    }));
  };
  const consume = async (chunkLike) => {
    if (signal?.aborted) throw Object.assign(new Error('Update download was cancelled'), { name: 'AbortError', code: 'update_download_cancelled' });
    const chunk = Buffer.from(chunkLike);
    total += chunk.length;
    if (total > maxBytes) throw new Error(`Update package exceeds ${maxBytes} byte limit`);
    if (total > expectedBytes) throw new Error(`Update package byte count mismatch: expected ${expectedBytes}, got more than expected`);
    if (headerBytes < header.length) {
      const copied = Math.min(header.length - headerBytes, chunk.length);
      chunk.copy(header, headerBytes, 0, copied);
      headerBytes += copied;
    }
    hash.update(chunk);
    let offset = 0;
    while (offset < chunk.length) {
      const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
      if (!bytesWritten) throw new Error('Update package write made no progress');
      offset += bytesWritten;
    }
    report();
  };

  try {
    handle = await open(destination, 'wx', 0o600);
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          await consume(value);
        }
      } catch (error) {
        await reader.cancel(error).catch(() => {});
        throw error;
      }
    } else {
      await consume(await response.arrayBuffer());
    }
    if (total !== expectedBytes) throw new Error(`Update package byte count mismatch: expected ${expectedBytes}, got ${total}`);
    await handle.sync();
    report();
    return Object.freeze({ bytes: total, sha256: hash.digest('hex'), header: header.subarray(0, headerBytes) });
  } catch (error) {
    await handle?.close().catch(() => {});
    handle = null;
    await rm(destination, { force: true }).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export class UpdateService {
  constructor({ currentVersion, launcherVersion, channel = 'stable', repository = null, endpoint, publicKey, dataDir, fetchImpl = fetch, maxPackageBytes = 512 * 1024 * 1024 } = {}) {
    this.currentVersion = parseVersion(currentVersion).raw; this.launcherVersion = parseVersion(launcherVersion).raw;
    this.channel = String(channel); if (!['alpha', 'beta', 'stable', 'nightly'].includes(this.channel)) throw new TypeError('Unsupported update channel');
    this.repository = repository == null || repository === '' ? null : requireRepository(repository);
    this.endpoint = endpoint == null || endpoint === '' ? null : (this.repository ? validateManifestEndpoint(endpoint, this.repository) : safeHttps(endpoint, 'Update endpoint').href);
    if (!publicKey) throw new TypeError('Update publicKey is required'); this.publicKey = publicKey;
    this.dataDir = path.resolve(String(dataDir ?? '.')); this.fetchImpl = fetchImpl; this.maxPackageBytes = Math.max(1024, Number(maxPackageBytes) || 512 * 1024 * 1024);
  }

  async verifyManifest(manifest) {
    if (!manifest || !['nolane.agent.update.v1', 'forge.studio.update.v1', 'nolane.agent.update.v2'].includes(manifest.schema)) throw new Error('Unsupported update manifest schema');
    if (manifest.channel !== this.channel) throw new Error(`Manifest channel ${manifest.channel} does not match ${this.channel}`);
    parseVersion(manifest.version); parseVersion(manifest.minimumLauncherVersion);
    if (compareVersion(manifest.version, this.currentVersion) <= 0) throw new Error(`Update version ${manifest.version} is not newer than ${this.currentVersion}`);
    if (compareVersion(this.launcherVersion, manifest.minimumLauncherVersion) < 0) throw new Error(`Launcher ${this.launcherVersion} is below required ${manifest.minimumLauncherVersion}`);
    safeHttps(manifest.package?.url, 'Update package URL');
    if (!Number.isSafeInteger(manifest.package?.bytes) || manifest.package.bytes < 1 || manifest.package.bytes > this.maxPackageBytes) throw new Error(`Update package exceeds ${this.maxPackageBytes} byte limit`);
    if (!/^[a-f0-9]{64}$/.test(String(manifest.package?.sha256 ?? ''))) throw new Error('Update package SHA-256 is invalid');

    if (manifest.schema === 'nolane.agent.update.v2') {
      if (!this.repository) throw new Error('Update repository is required for v2 manifests');
      if (manifest.repository !== this.repository) throw new Error(`Manifest repository ${manifest.repository} does not match ${this.repository}`);
      if (manifest.package?.kind !== 'nsis') throw new Error('v2 update package must be an NSIS installer');
      validateGitHubReleaseManifestFields({
        repository: manifest.repository,
        tag: manifest.release?.tag,
        commit: manifest.release?.commit,
        packageName: manifest.package?.name,
        packageUrl: manifest.package?.url,
        releaseNotesUrl: manifest.release?.notesUrl,
      });
    }

    let signature; try { signature = Buffer.from(String(manifest.signature ?? ''), 'base64'); } catch { throw new Error('Update signature is invalid') }
    const valid = verify(null, Buffer.from(canonicalJson(unsignedManifest(manifest))), this.publicKey, signature);
    if (!valid) throw new Error('Update manifest signature verification failed');
    return Object.freeze(structuredClone(manifest));
  }

  async check() {
    if (!this.endpoint) return Object.freeze({ available: false, reason: 'update-endpoint-disabled' });
    const response = await fetchWithControlledRedirects(this.fetchImpl, this.endpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Update manifest HTTP ${response.status}`);
    const raw = await response.text(); if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('Update manifest exceeds 262144 byte limit');
    let manifest; try { manifest = JSON.parse(raw); } catch { throw new Error('Update manifest is invalid JSON') }
    try { return Object.freeze({ available: true, manifest: await this.verifyManifest(manifest) }); }
    catch (error) { if (/not newer/i.test(error.message)) return Object.freeze({ available: false, reason: 'up-to-date', version: manifest?.version ?? null }); throw error; }
  }

  async stage(manifest, { signal = null, onProgress = null } = {}) {
    const verified = await this.verifyManifest(manifest);
    const packageUrl = safeHttps(verified.package.url, 'Update package URL').href;
    const updates = path.join(this.dataDir, 'updates');
    await mkdir(updates, { recursive: true });

    let packagePath;
    let entries = 0;
    let packageKind = 'zip';
    if (verified.schema === 'nolane.agent.update.v2') {
      packageKind = 'nsis';
      packagePath = path.join(updates, verified.package.name);
    } else {
      packagePath = path.join(updates, `NolaneAgent-${verified.version}.zip`);
    }
    const temp = `${packagePath}.${process.pid}.${randomUUID()}.partial`;
    const downloaded = await streamDownloadToFile(this.fetchImpl, packageUrl, {
      destination: temp,
      maxBytes: this.maxPackageBytes,
      expectedBytes: verified.package.bytes,
      signal,
      onProgress,
    });
    if (downloaded.sha256 !== verified.package.sha256) {
      await rm(temp, { force: true }).catch(() => {});
      throw new Error(`Update package hash mismatch: expected ${verified.package.sha256}, got ${downloaded.sha256}`);
    }

    if (packageKind === 'nsis') {
      if (downloaded.header.length < 2 || downloaded.header[0] !== 0x4d || downloaded.header[1] !== 0x5a) {
        await rm(temp, { force: true }).catch(() => {});
        throw new Error('NSIS installer is not a Windows PE executable (missing MZ header)');
      }
    } else {
      const archive = await readFile(temp);
      const inspected = inspectZipEntries(archive);
      if (!inspected.some((entry) => /(^|\/)NolaneAgent\.exe$/i.test(entry.path))) {
        await rm(temp, { force: true }).catch(() => {});
        throw new Error('Update package does not contain NolaneAgent.exe');
      }
      entries = inspected.length;
    }

    await rm(packagePath, { force: true }).catch(() => {});
    await rename(temp, packagePath);
    const markerPath = path.join(updates, 'pending-update.json');
    const markerTemp = `${markerPath}.${process.pid}.${randomUUID()}.tmp`;
    const marker = verified.schema === 'nolane.agent.update.v2'
      ? { schema: 'nolane.agent.pending-update.v2', version: verified.version, packageKind, packageName: verified.package.name, sha256: downloaded.sha256, bytes: downloaded.bytes, packagePath, releaseTag: verified.release.tag, releaseCommit: verified.release.commit, releaseNotesUrl: verified.release.notesUrl, stagedAt: new Date().toISOString(), healthTimeoutMs: 30_000 }
      : { schema: 'nolane.agent.pending-update.v1', version: verified.version, packageKind, sha256: downloaded.sha256, bytes: downloaded.bytes, packagePath, stagedAt: new Date().toISOString(), healthTimeoutMs: 30_000 };
    try {
      await writeFile(markerTemp, JSON.stringify(marker), { flag: 'wx', mode: 0o600 });
      await rename(markerTemp, markerPath);
    } catch (error) {
      await rm(packagePath, { force: true }).catch(() => {});
      throw error;
    } finally {
      await rm(markerTemp, { force: true }).catch(() => {});
    }
    return Object.freeze({ ...marker, markerPath, entries });
  }

}

export { compareVersion };
