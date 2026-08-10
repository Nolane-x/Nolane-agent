import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './canonical-json.mjs';

const DEFAULT_ROOTS = Object.freeze(['settings', 'onboarding', 'session', 'personalization']);
const BLOCKED_NAME = /(?:credential|secret|private|token|vault|\.pem$|\.key$|\.p12$|\.pfx$)/i;

function safeVersion(value, label) {
  const text = String(value ?? '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text)) throw new TypeError(`${label} is invalid`);
  return text;
}

async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function ensureInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Snapshot path escapes its root');
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temporary, file);
}

export class PreUpdateSnapshotService {
  constructor({ dataDir, store, clock = () => new Date().toISOString(), roots = DEFAULT_ROOTS, maxJsonBytes = 32 * 1024 * 1024 } = {}) {
    if (!store?.snapshotTo) throw new TypeError('PreUpdateSnapshotService requires a store snapshotTo() method');
    this.dataDir = path.resolve(String(dataDir ?? '.'));
    this.store = store;
    this.clock = clock;
    this.roots = Object.freeze([...new Set(roots.map(String))]);
    this.maxJsonBytes = Math.max(1024, Number(maxJsonBytes) || 32 * 1024 * 1024);
  }

  async create({ fromVersion, toVersion } = {}) {
    const sourceVersion = safeVersion(fromVersion, 'fromVersion');
    const targetVersion = safeVersion(toVersion, 'toVersion');
    const snapshotId = `snapshot_${randomUUID().replaceAll('-', '')}`;
    const root = path.join(this.dataDir, 'updates', 'snapshots', snapshotId);
    ensureInside(this.dataDir, root);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const entries = [];
    let copiedBytes = 0;

    const recordFile = async ({ source, relative, dataClass }) => {
      if (BLOCKED_NAME.test(relative)) throw new Error(`Sensitive snapshot path is forbidden: ${relative}`);
      const info = await lstat(source);
      if (info.isSymbolicLink()) throw new Error(`Snapshot symlink is forbidden: ${relative}`);
      if (!info.isFile()) return;
      copiedBytes += info.size;
      if (copiedBytes > this.maxJsonBytes) throw new Error(`Snapshot metadata exceeds ${this.maxJsonBytes} byte limit`);
      const destination = path.join(root, relative);
      ensureInside(root, destination);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await copyFile(source, destination);
      const canonicalRelative = String(relative).replaceAll('\\', '/');
      entries.push(Object.freeze({ dataClass, sourceRelative: canonicalRelative, snapshotRelative: canonicalRelative, bytes: info.size, sha256: await sha256File(destination) }));
    };

    const copyTree = async (sourceRoot, relativeRoot, dataClass) => {
      let info;
      try { info = await lstat(sourceRoot); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      if (info.isSymbolicLink()) throw new Error(`Snapshot symlink is forbidden: ${relativeRoot}`);
      if (info.isFile()) return recordFile({ source: sourceRoot, relative: relativeRoot, dataClass });
      if (!info.isDirectory()) return;
      for (const item of await readdir(sourceRoot, { withFileTypes: true })) {
        const relative = path.join(relativeRoot, item.name);
        if (BLOCKED_NAME.test(relative)) continue;
        if (item.isSymbolicLink()) throw new Error(`Snapshot symlink is forbidden: ${relative}`);
        if (item.isDirectory()) await copyTree(path.join(sourceRoot, item.name), relative, dataClass);
        else if (item.isFile() && item.name.endsWith('.json')) await recordFile({ source: path.join(sourceRoot, item.name), relative, dataClass });
      }
    };

    try {
      const databaseRelative = 'database/nolane-agent.db';
      const databaseDestination = path.join(root, databaseRelative);
      await mkdir(path.dirname(databaseDestination), { recursive: true, mode: 0o700 });
      await this.store.snapshotTo(databaseDestination);
      const databaseInfo = await lstat(databaseDestination);
      entries.push(Object.freeze({ dataClass: 'core-database', sourceRelative: 'nolane-agent.db', snapshotRelative: databaseRelative, bytes: databaseInfo.size, sha256: await sha256File(databaseDestination) }));

      for (const relativeRoot of this.roots) await copyTree(path.join(this.dataDir, relativeRoot), relativeRoot, 'product-metadata');
      entries.sort((a, b) => a.snapshotRelative.localeCompare(b.snapshotRelative));
      const base = {
        schema: 'nolane.pre-update-snapshot.v1',
        snapshotId,
        fromVersion: sourceVersion,
        toVersion: targetVersion,
        createdAt: this.clock(),
        preserveUserData: true,
        entries,
        exclusions: Object.freeze(['os-vault-credentials', 'provider-secrets', 'caches', 'downloaded-installers', 'workspace-files']),
        uncertifiedStores: Object.freeze(['provider-outcomes.db', 'capabilities.db', 'workspace-trust.db', 'plugin-transparency.db', 'context-history.db']),
      };
      const manifest = Object.freeze({ ...base, receiptSha256: createHash('sha256').update(canonicalJson(base)).digest('hex') });
      const manifestPath = path.join(root, 'snapshot-manifest.json');
      await atomicJson(manifestPath, manifest);
      return Object.freeze({ ...manifest, root, manifestPath });
    } catch (error) {
      await rm(root, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }
}
