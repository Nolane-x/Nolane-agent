import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AuditHashChain } from '../security/audit-hash-chain.mjs';
import { redactSecrets } from '../security/redaction.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';
import { LocalDeviceDoctor } from '../runtime/local-device-doctor.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const required = (value, name) => {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
};
const exists = async (target) => { try { await stat(target); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } };

export class OperationsSecurityFabric {
  #dataDir;
  #workspaceRoot;
  #backupRoot;
  #auditFile;
  #dependencyFile;
  #allowedHosts;
  #clock;
  #policy;
  #audit = new AuditHashChain();
  #dependencies = [];
  #backupCount = 0;
  #ready = false;
  #doctor = new LocalDeviceDoctor();

  constructor({ dataDir, workspaceRoot, allowedHosts = [], clock = () => Date.now() } = {}) {
    this.#dataDir = path.resolve(required(dataDir, 'dataDir'));
    this.#workspaceRoot = path.resolve(required(workspaceRoot, 'workspaceRoot'));
    this.#backupRoot = path.join(this.#dataDir, 'backups');
    this.#auditFile = path.join(this.#dataDir, 'operations-audit.json');
    this.#dependencyFile = path.join(this.#dataDir, 'dependency-provenance.json');
    if (!Array.isArray(allowedHosts)) throw new TypeError('allowedHosts must be an array');
    this.#allowedHosts = new Set(allowedHosts.map((item) => required(item, 'allowed host').toLowerCase()));
    if (typeof clock !== 'function') throw new TypeError('clock must be a function');
    this.#clock = clock;
    this.#policy = new WorkspacePolicy(this.#workspaceRoot, { allowedPaths: ['**'], deniedPaths: ['.git/**', '.env', '.env.*', '**/*.pem', '**/*.key'] });
  }

  async open() {
    await Promise.all([mkdir(this.#workspaceRoot, { recursive: true }), mkdir(this.#backupRoot, { recursive: true })]);
    this.#audit.entries = await this.#loadJson(this.#auditFile, []);
    const verified = this.#audit.verify(this.#audit.entries);
    if (verified.status !== 'pass') throw new Error(`Operations audit chain is tampered at sequence ${verified.failedSequence}`);
    this.#dependencies = await this.#loadJson(this.#dependencyFile, []);
    await this.recoverIncomplete();
    this.#backupCount = (await readdir(this.#backupRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.tmp-')).length;
    this.#ready = true;
    return this.status();
  }

  sanitize(value, { secretValues = [] } = {}) { return freeze(redactSecrets(structuredClone(value), { secretValues })); }

  async recordAudit({ actorId, scope, eventType, payload = {}, secretValues = [] } = {}) {
    const safePayload = this.sanitize(payload, { secretValues });
    const entry = this.#audit.append({ actorId, scope, event: { type: required(eventType, 'eventType'), digest: sha256(canonical(safePayload)) } });
    await this.#atomicJson(this.#auditFile, this.#audit.entries);
    return entry;
  }

  auditEntries() { return freeze(structuredClone(this.#audit.entries)); }
  verifyAudit(entries = this.#audit.entries) { return this.#audit.verify(entries); }

  authorizeEgress({ url } = {}) {
    let parsed;
    try { parsed = new URL(required(url, 'url')); } catch { throw new TypeError('Valid egress URL is required'); }
    if (parsed.protocol !== 'https:') throw new Error('Egress URL must use HTTPS');
    if (parsed.username || parsed.password) throw new Error('Egress URL credentials are forbidden');
    const host = parsed.hostname.toLowerCase();
    if (!this.#allowedHosts.has(host)) throw new Error(`Egress host is not on the allowlist: ${host}`);
    const base = { schema: 'nolane.native.egress-authorization.v1', allowed: true, origin: parsed.origin, host, pathSha256: sha256(`${parsed.pathname}${parsed.search}`), authorizedAt: this.#clock() };
    return freeze({ ...base, receiptSha256: sha256(canonical(base)) });
  }

  async createBackup({ paths } = {}) {
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 1_000) throw new TypeError('paths must contain 1 to 1000 workspace-relative files');
    const createdAt = this.#clock();
    const normalized = [...new Set(paths.map((item) => required(item, 'backup path').replaceAll('\\', '/')))].sort();
    const descriptors = [];
    const sourceFiles = [];
    for (const relative of normalized) {
      const lexical = path.resolve(this.#workspaceRoot, relative);
      const lexicalStat = await lstat(lexical);
      if (lexicalStat.isSymbolicLink()) throw new Error(`Backup path is a symlink: ${relative}`);
      const resolved = await this.#policy.resolveRead(relative);
      const fileStat = await stat(resolved);
      if (!fileStat.isFile()) throw new Error(`Backup path must be a regular file: ${relative}`);
      const bytes = await readFile(resolved);
      const safeRelative = this.#policy.relative(resolved).replaceAll('\\', '/');
      descriptors.push(freeze({ path: safeRelative, bytes: bytes.length, sha256: sha256(bytes), mode: fileStat.mode & 0o777 }));
      sourceFiles.push({ resolved, relative: safeRelative });
    }
    const manifestBase = { schema: 'nolane.native.backup-manifest.v1', createdAt, workspaceIdSha256: sha256(this.#workspaceRoot), files: descriptors };
    const manifestSha256 = sha256(canonical(manifestBase));
    const backupId = `backup_${manifestSha256.slice(0, 20)}_${createdAt}`;
    const temporary = path.join(this.#backupRoot, `.tmp-${backupId}`);
    const destination = path.join(this.#backupRoot, backupId);
    await rm(temporary, { recursive: true, force: true });
    await mkdir(path.join(temporary, 'files'), { recursive: true });
    try {
      for (const item of sourceFiles) {
        const target = path.join(temporary, 'files', item.relative);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(item.resolved, target);
      }
      const manifest = freeze({ ...manifestBase, backupId, manifestSha256 });
      await writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
      await rename(temporary, destination);
      this.#backupCount += 1;
      await this.recordAudit({ actorId: 'system', scope: 'backup', eventType: 'backup.created', payload: { backupId, manifestSha256, files: descriptors.length } });
      return manifest;
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  async restoreBackup({ backupId } = {}) {
    const id = required(backupId, 'backupId');
    if (!/^backup_[a-f0-9]{20}_[0-9]+$/.test(id)) throw new TypeError('backupId is invalid');
    const root = path.join(this.#backupRoot, id);
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    const { backupId: storedId, manifestSha256, ...manifestBase } = manifest;
    if (storedId !== id || sha256(canonical(manifestBase)) !== manifestSha256) throw new Error('Backup manifest hash mismatch');
    let restored = 0;
    for (const descriptor of manifest.files ?? []) {
      const source = path.join(root, 'files', descriptor.path);
      const bytes = await readFile(source);
      if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) throw new Error(`Backup content hash mismatch: ${descriptor.path}`);
      const target = await this.#policy.resolveWrite(descriptor.path);
      await mkdir(path.dirname(target), { recursive: true });
      const suffix = `${process.pid}-${this.#clock()}`;
      const temporary = `${target}.nolane-restore-${suffix}`;
      const previous = `${target}.nolane-previous-${suffix}`;
      await writeFile(temporary, bytes, { flag: 'wx', mode: descriptor.mode ?? 0o600 });
      const hadTarget = await exists(target);
      try {
        if (hadTarget) await rename(target, previous);
        await rename(temporary, target);
        if (hadTarget) await rm(previous, { force: true });
      } catch (error) {
        await rm(temporary, { force: true });
        if (hadTarget && await exists(previous) && !await exists(target)) await rename(previous, target);
        throw error;
      }
      restored += 1;
    }
    const base = { schema: 'nolane.native.backup-restore.v1', backupId: id, manifestSha256, restored, restoredAt: this.#clock() };
    const receipt = freeze({ ...base, receiptSha256: sha256(canonical(base)) });
    await this.recordAudit({ actorId: 'system', scope: 'backup', eventType: 'backup.restored', payload: receipt });
    return receipt;
  }

  async recoverIncomplete() {
    await mkdir(this.#backupRoot, { recursive: true });
    const entries = await readdir(this.#backupRoot, { withFileTypes: true });
    let removed = 0;
    for (const entry of entries) {
      if (!entry.name.startsWith('.tmp-')) continue;
      await rm(path.join(this.#backupRoot, entry.name), { recursive: true, force: true });
      removed += 1;
    }
    const base = { schema: 'nolane.native.atomic-recovery.v1', removed, recoveredAt: this.#clock() };
    return freeze({ ...base, receiptSha256: sha256(canonical(base)) });
  }

  async recordDependency({ name, version, integrity, source } = {}) {
    const normalizedIntegrity = required(integrity, 'integrity').toLowerCase();
    if (!/^sha256-[a-f0-9]{64}$/.test(normalizedIntegrity)) throw new TypeError('dependency integrity must be sha256- followed by 64 hex characters');
    const base = { schema: 'nolane.native.dependency-provenance.v1', name: required(name, 'name'), version: required(version, 'version'), integrity: normalizedIntegrity, source: required(source, 'source'), recordedAt: this.#clock() };
    const receipt = freeze({ ...base, receiptSha256: sha256(canonical(base)) });
    this.#dependencies.push(receipt);
    await this.#atomicJson(this.#dependencyFile, this.#dependencies);
    await this.recordAudit({ actorId: 'system', scope: 'dependencies', eventType: 'dependency.recorded', payload: receipt });
    return receipt;
  }

  diagnoseDevice(input) { return this.#doctor.diagnose(input); }

  status() {
    return freeze({ schema: 'nolane.native.operations-security.v1', ready: this.#ready, backups: this.#backupCount, auditEntries: this.#audit.entries.length, dependencies: this.#dependencies.length, allowedEgressHosts: [...this.#allowedHosts].sort() });
  }

  async #loadJson(file, fallback) {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; }
  }

  async #atomicJson(file, value) {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${this.#clock()}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(temporary, file);
  }
}
