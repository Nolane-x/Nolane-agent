import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';

const DEFAULT_EXCLUDES = new Set(['.git', '.forge', '.forge-studio', 'node_modules', 'dist', 'build', 'coverage', '.DS_Store']);
const SENSITIVE_NAME = /^(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx|jks|keystore))$/i;

function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function isBinary(buffer) { if (!buffer.length) return false; const sample = buffer.subarray(0, Math.min(buffer.length, 8192)); let suspicious = 0; for (const byte of sample) { if (byte === 0) return true; if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1; } return suspicious / sample.length > 0.08; }
function relativeJoin(parent, name) { return (parent === '.' ? name : `${parent.replaceAll('\\', '/')}/${name}`).replace(/^\.\//, ''); }

export class FileService {
  constructor({ store, brokerFactory, maxFileBytes = 2_000_000, maxEntries = 2_000, excludes = DEFAULT_EXCLUDES } = {}) {
    if (!store) throw new TypeError('store is required');
    if (typeof brokerFactory !== 'function') throw new TypeError('brokerFactory is required');
    this.store = store;
    this.brokerFactory = brokerFactory;
    this.maxFileBytes = Math.max(1, Number(maxFileBytes) || 2_000_000);
    this.maxEntries = Math.max(10, Number(maxEntries) || 2_000);
    this.excludes = new Set(excludes);
  }

  #project(projectId) { const project = this.store.getProject(required(projectId, 'projectId')); if (!project) throw Object.assign(new Error(`Unknown project: ${projectId}`), { statusCode: 404 }); return project; }
  #policy(project) { return new WorkspacePolicy(project.workspaceRoot, { allowedPaths: ['**'], deniedPaths: ['.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx'] }); }
  #broker(project) { return this.brokerFactory(project.workspaceRoot, project); }
  #visibleName(name) { return !this.excludes.has(name) && !SENSITIVE_NAME.test(name) && !/^\.studio\.db(?:-wal|-shm)?$/.test(name); }

  async tree({ projectId, directory = '.' } = {}) {
    const project = this.#project(projectId); const policy = this.#policy(project);
    const absolute = await policy.resolveRead(directory);
    const info = await lstat(absolute);
    if (!info.isDirectory()) throw Object.assign(new Error('Tree path is not a directory'), { statusCode: 400 });
    const parent = policy.relative(absolute).replaceAll('\\', '/');
    const values = [];
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      if (values.length >= this.maxEntries || !this.#visibleName(entry.name) || entry.isSymbolicLink()) continue;
      const relative = relativeJoin(parent, entry.name);
      if (entry.isDirectory()) { values.push({ name: entry.name, path: relative, type: 'directory' }); continue; }
      if (!entry.isFile()) continue;
      const file = path.join(absolute, entry.name); const fileInfo = await stat(file);
      if (fileInfo.size > this.maxFileBytes) continue;
      const preview = await readFile(file); if (isBinary(preview)) continue;
      values.push({ name: entry.name, path: relative, type: 'file', bytes: fileInfo.size });
    }
    values.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
    return Object.freeze({ projectId: project.id, directory: parent, entries: Object.freeze(values) });
  }

  async read({ projectId, file } = {}) {
    const project = this.#project(projectId); const policy = this.#policy(project);
    const absolute = await policy.resolveRead(required(file, 'file')); const info = await stat(absolute);
    if (!info.isFile()) throw Object.assign(new Error('File path is not a regular file'), { statusCode: 400 });
    if (info.size > this.maxFileBytes) throw Object.assign(new Error(`File exceeds ${this.maxFileBytes} byte limit`), { statusCode: 413 });
    const buffer = await readFile(absolute); if (isBinary(buffer)) throw Object.assign(new Error('Binary files are not supported by the editor'), { statusCode: 415 });
    const content = buffer.toString('utf8');
    return Object.freeze({ projectId: project.id, path: policy.relative(absolute).replaceAll('\\', '/'), bytes: buffer.length, content, sha256: canonicalSha256(content), modifiedAt: info.mtime.toISOString() });
  }

  async write({ projectId, file, content, expectedSha256 } = {}) {
    const project = this.#project(projectId); required(file, 'file');
    const value = String(content ?? ''); if (Buffer.byteLength(value) > this.maxFileBytes) throw Object.assign(new Error(`File exceeds ${this.maxFileBytes} byte limit`), { statusCode: 413 });
    try { return await this.#broker(project).execute({ tool: 'fs.write', input: { path: file, content: value, expectedSha256 } }, { refs: { projectId: project.id, surface: 'workroom-editor' } }); }
    catch (error) {
      if (!/File hash mismatch/i.test(String(error?.message))) throw error;
      let current = null; try { current = await this.read({ projectId, file }); } catch {}
      const conflict = new Error('File changed on disk after it was opened'); conflict.statusCode = 409; conflict.code = 'FILE_CONFLICT'; conflict.current = current; throw conflict;
    }
  }

  async diff({ projectId, file, content } = {}) {
    const current = await this.read({ projectId, file }); const modified = String(content ?? '');
    if (Buffer.byteLength(modified) > this.maxFileBytes) throw Object.assign(new Error(`File exceeds ${this.maxFileBytes} byte limit`), { statusCode: 413 });
    return Object.freeze({ projectId: current.projectId, path: current.path, original: current.content, modified, originalSha256: current.sha256, modifiedSha256: canonicalSha256(modified), changed: current.content !== modified });
  }
}
