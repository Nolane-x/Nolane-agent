import { createHash, timingSafeEqual } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PACKAGES = Object.freeze([
  Object.freeze({
    id: 'xterm', version: '6.0.0',
    url: 'https://registry.npmjs.org/@xterm/xterm/-/xterm-6.0.0.tgz',
    integrity: 'sha512-TQwDdQGtwwDt+2cgKDLn0IRaSxYu1tSUjgKarSDkUM0ZNiSRXFpjxEsvc/Zgc5kq5omJ+V0a8/kIM2WD3sMOYg==',
    files: Object.freeze([
      Object.freeze({ from: 'package/lib/xterm.mjs', to: 'xterm/xterm.mjs' }),
      Object.freeze({ from: 'package/css/xterm.css', to: 'xterm/xterm.css' }),
      Object.freeze({ from: 'package/LICENSE', to: 'xterm/LICENSE' }),
    ]),
  }),
  Object.freeze({
    id: 'xterm-fit', version: '0.11.0',
    url: 'https://registry.npmjs.org/@xterm/addon-fit/-/addon-fit-0.11.0.tgz',
    integrity: 'sha512-jYcgT6xtVYhnhgxh3QgYDnnNMYTcf8ElbxxFzX0IZo+vabQqSPAjC3c1wJrKB5E19VwQei89QCiZZP86DCPF7g==',
    files: Object.freeze([
      Object.freeze({ from: 'package/lib/addon-fit.mjs', to: 'xterm/addon-fit.mjs' }),
      Object.freeze({ from: 'package/LICENSE', to: 'xterm/LICENSE-addon-fit' }),
    ]),
  }),
  Object.freeze({
    id: 'monaco', version: '0.55.1',
    url: 'https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.55.1.tgz',
    integrity: 'sha512-jz4x+TJNFHwHtwuV9vA9rMujcZRb0CEilTEwG2rRSpe/A7Jdkuj8xPKttCgOh+v/lkHy7HsZ64oj+q3xoAFl9A==',
    includePrefix: 'package/min/vs/', stripPrefix: 'package/min/', toPrefix: 'monaco/',
    extraFiles: Object.freeze([
      Object.freeze({ from: 'package/LICENSE', to: 'monaco/LICENSE' }),
      Object.freeze({ from: 'package/ThirdPartyNotices.txt', to: 'monaco/ThirdPartyNotices.txt' }),
    ]),
  }),
]);

function cleanTarName(value) {
  const normalized = String(value).replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) throw new Error(`Unsafe tar path: ${value}`);
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe tar path: ${value}`);
  return normalized;
}
function parseOctal(buffer, start, length) {
  const raw = buffer.subarray(start, start + length).toString('ascii').replace(/\0.*$/, '').trim();
  if (!raw) return 0;
  if (!/^[0-7]+$/.test(raw)) throw new Error('Invalid tar numeric field');
  return Number.parseInt(raw, 8);
}
function field(buffer, start, length) { return buffer.subarray(start, start + length).toString('utf8').replace(/\0.*$/, ''); }

export function* parseTar(archive, { maxEntries = 20_000, maxFileBytes = 16 * 1024 * 1024, maxTotalBytes = 128 * 1024 * 1024 } = {}) {
  const bytes = Buffer.from(archive); let offset = 0; let entries = 0; let total = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512); offset += 512;
    if (header.every((byte) => byte === 0)) break;
    const name = cleanTarName(`${field(header, 345, 155)}${field(header, 345, 155) ? '/' : ''}${field(header, 0, 100)}`);
    const type = field(header, 156, 1) || '0';
    const size = parseOctal(header, 124, 12);
    if (!Number.isSafeInteger(size) || size < 0 || size > maxFileBytes) throw new Error(`Tar entry too large: ${name}`);
    const padded = Math.ceil(size / 512) * 512;
    if (offset + padded > bytes.length) throw new Error(`Truncated tar entry: ${name}`);
    if (type !== '0' && type !== '\0') {
      if (type === '5') { offset += padded; continue; }
      throw new Error(`Unsupported tar entry type ${type} for ${name}`);
    }
    entries += 1; total += size;
    if (entries > maxEntries || total > maxTotalBytes) throw new Error('Tar archive exceeds bounded extraction limits');
    const data = Buffer.from(bytes.subarray(offset, offset + size)); offset += padded;
    yield Object.freeze({ path: name, data });
  }
}

function verifySri(body, integrity) {
  const match = /^sha512-(.+)$/.exec(String(integrity ?? ''));
  if (!match) throw new Error('Only pinned SHA-512 SRI integrity is supported');
  const actual = createHash('sha512').update(body).digest();
  const expected = Buffer.from(match[1], 'base64');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('UI asset package integrity mismatch');
}
function safeDestination(root, relative) {
  const normalized = String(relative).replaceAll('\\', '/');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe asset destination: ${relative}`);
  const target = path.resolve(root, normalized); const rel = path.relative(path.resolve(root), target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Unsafe asset destination: ${relative}`);
  return target;
}
async function listFiles(root, current = root) {
  const output = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(root, absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

export class UiAssetInstaller {
  constructor({ root, packages = DEFAULT_PACKAGES, fetchImpl = globalThis.fetch, maxPackageBytes = 64 * 1024 * 1024, timeoutMs = 120_000 } = {}) {
    if (!root) throw new TypeError('UI asset root is required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
    this.root = path.resolve(root); this.packages = packages.map((item) => ({ ...item })); this.fetchImpl = fetchImpl;
    this.maxPackageBytes = Math.max(1, Number(maxPackageBytes)); this.timeoutMs = Math.max(1, Number(timeoutMs)); this.installPromise = null;
  }

  async status() {
    try {
      const manifest = JSON.parse(await readFile(path.join(this.root, 'asset-manifest.json'), 'utf8'));
      if (manifest.schema !== 'forge.studio.ui-assets.v1') return { ready: false, reason: 'manifest-schema' };
      const installedPackages = new Map((manifest.packages ?? []).map((item) => [item.id, item]));
      for (const expected of this.packages) {
        const installed = installedPackages.get(expected.id);
        if (!installed) return { ready: false, reason: 'asset-package', package: expected.id };
        if (installed.version !== expected.version) return { ready: false, reason: 'asset-version', package: expected.id };
        if (installed.integrity !== expected.integrity) return { ready: false, reason: 'asset-package-integrity', package: expected.id };
      }
      for (const file of manifest.files ?? []) {
        const absolute = safeDestination(this.root, file.path); const info = await stat(absolute);
        if (!info.isFile() || info.size !== file.bytes) return { ready: false, reason: 'asset-mismatch', path: file.path };
        const actual = createHash('sha256').update(await readFile(absolute)).digest('hex');
        if (actual !== file.sha256) return { ready: false, reason: 'asset-integrity', path: file.path };
      }
      return { ready: true, manifest };
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return { ready: false, reason: 'not-installed' };
      return { ready: false, reason: 'invalid-install', detail: String(error.message ?? error) };
    }
  }

  async install() {
    if (this.installPromise) return this.installPromise;
    this.installPromise = this.#install().finally(() => { this.installPromise = null; });
    return this.installPromise;
  }

  async #download(definition) {
    const url = new URL(definition.url);
    if (url.protocol !== 'https:') throw new Error(`UI asset package must use HTTPS: ${definition.id}`);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(new Error('UI asset download timed out')), this.timeoutMs); timer.unref?.();
    try {
      const response = await this.fetchImpl(url.href, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/octet-stream', 'user-agent': 'ForgeStudio-AssetInstaller/0.4' } });
      if (!response.ok) throw new Error(`UI asset download failed for ${definition.id}: HTTP ${response.status}`);
      const announced = Number(response.headers.get('content-length') ?? 0);
      if (announced > this.maxPackageBytes) throw new Error(`UI asset package too large: ${definition.id}`);
      const reader = response.body?.getReader?.();
      if (!reader) {
        const body = Buffer.from(await response.arrayBuffer());
        if (body.length > this.maxPackageBytes) throw new Error(`UI asset package too large: ${definition.id}`);
        return body;
      }
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > this.maxPackageBytes) { await reader.cancel(); throw new Error(`UI asset package too large: ${definition.id}`); }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks, size);
    } finally { clearTimeout(timer); }
  }

  async #install() {
    const parent = path.dirname(this.root); await mkdir(parent, { recursive: true });
    const staging = `${this.root}.staging-${process.pid}-${Date.now()}`; await rm(staging, { recursive: true, force: true }); await mkdir(staging, { recursive: true });
    try {
      for (const definition of this.packages) {
        const tgz = await this.#download(definition); verifySri(tgz, definition.integrity);
        let archive; try { archive = gunzipSync(tgz, { maxOutputLength: 160 * 1024 * 1024 }); } catch (error) { throw new Error(`Invalid gzip package for ${definition.id}: ${error.message}`); }
        const entries = new Map(); for (const entry of parseTar(archive)) entries.set(entry.path, entry.data);
        const mappings = [...(definition.files ?? []), ...(definition.extraFiles ?? [])];
        for (const mapping of mappings) {
          const data = entries.get(mapping.from); if (!data) throw new Error(`Pinned asset is missing from ${definition.id}: ${mapping.from}`);
          const destination = safeDestination(staging, mapping.to); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, data, { mode: 0o644 });
        }
        if (definition.includePrefix) {
          for (const [name, data] of entries) {
            if (!name.startsWith(definition.includePrefix) || name.endsWith('.map')) continue;
            const relative = name.slice(String(definition.stripPrefix ?? '').length);
            const destination = safeDestination(staging, `${definition.toPrefix ?? ''}${relative}`); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, data, { mode: 0o644 });
          }
        }
      }
      const files = [];
      for (const absolute of (await listFiles(staging)).sort()) {
        const info = await stat(absolute); const relative = path.relative(staging, absolute).replaceAll('\\', '/');
        files.push({ path: relative, bytes: info.size, sha256: createHash('sha256').update(await readFile(absolute)).digest('hex') });
      }
      const manifest = {
        schema: 'forge.studio.ui-assets.v1', generatedAt: new Date().toISOString(),
        packages: this.packages.map(({ id, version, integrity }) => ({ id, version, integrity })), files,
      };
      await writeFile(path.join(staging, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
      const backup = `${this.root}.previous`; await rm(backup, { recursive: true, force: true });
      try { await rename(this.root, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      try { await rename(staging, this.root); } catch (error) { try { await rename(backup, this.root); } catch {} throw error; }
      await rm(backup, { recursive: true, force: true });
      return { ready: true, manifest };
    } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  }
}

export const PINNED_UI_PACKAGES = DEFAULT_PACKAGES;
