'use strict';

const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createReadStream } = require('node:fs');
const { open, readFile, rename, rm, stat, writeFile } = require('node:fs/promises');

async function inspectInstallerFile(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(2);
    const { bytesRead } = await handle.read(header, 0, 2, 0);
    if (bytesRead !== 2 || header[0] !== 0x4d || header[1] !== 0x5a) throw new Error('Pending installer is not a Windows PE executable');
  } finally { await handle.close(); }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function inside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function safeVersion(value) {
  const text = String(value ?? '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text)) throw new Error('Pending update version is invalid');
  return text;
}

class ElectronUpdateController {
  constructor({ userDataDir, currentVersion, platform = process.platform, spawnImpl = spawn, quit = () => {} } = {}) {
    this.userDataDir = path.resolve(String(userDataDir ?? '.'));
    this.updatesDir = path.join(this.userDataDir, 'updates');
    this.markerPath = path.join(this.updatesDir, 'pending-update.json');
    this.recoveryPath = path.join(this.updatesDir, 'update-recovery.json');
    this.currentVersion = safeVersion(currentVersion);
    this.platform = String(platform);
    this.spawnImpl = spawnImpl;
    this.quit = quit;
  }

  static publicApiShape() {
    return Object.freeze({ status: 'nolane:update-status', installAndRestart: 'nolane:update-install-and-restart' });
  }

  async #readMarker() {
    let marker;
    try { marker = JSON.parse(await readFile(this.markerPath, 'utf8')); }
    catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new Error(`Pending update marker is invalid: ${error.message}`);
    }
    if (marker?.schema !== 'nolane.agent.pending-update.v2' || marker.packageKind !== 'nsis') throw new Error('Pending update is not a supported signed NSIS update');
    safeVersion(marker.version);
    if (!/^[a-f0-9]{64}$/.test(String(marker.sha256 ?? ''))) throw new Error('Pending update hash is invalid');
    if (!Number.isSafeInteger(marker.bytes) || marker.bytes < 2) throw new Error('Pending update byte count is invalid');
    const installerPath = path.resolve(String(marker.packagePath ?? ''));
    if (!inside(this.updatesDir, installerPath)) throw new Error('Pending installer must remain inside the updates directory');
    if (path.basename(installerPath) !== marker.packageName || !/^NolaneAgent-Setup-[0-9A-Za-z.+-]+-x64\.exe$/.test(marker.packageName)) throw new Error('Pending installer name is invalid');
    return Object.freeze({ ...marker, packagePath: installerPath });
  }

  async #verifyInstaller(marker) {
    const info = await stat(marker.packagePath);
    if (!info.isFile() || info.size !== marker.bytes) throw new Error('Pending installer byte count mismatch');
    if (await inspectInstallerFile(marker.packagePath) !== marker.sha256) throw new Error('Pending installer hash mismatch');
    return marker;
  }

  async status() {
    const marker = await this.#readMarker();
    if (!marker) return Object.freeze({ ready: false, reason: 'no-staged-update' });
    await this.#verifyInstaller(marker);
    return Object.freeze({
      ready: true,
      version: marker.version,
      releaseTag: marker.releaseTag ?? null,
      releaseCommit: marker.releaseCommit ?? null,
      releaseNotesUrl: marker.releaseNotesUrl ?? null,
      stagedAt: marker.stagedAt ?? null,
    });
  }

  async installAndRestart(preparation = null) {
    if (this.platform !== 'win32') throw new Error('NSIS updates can only be installed on Windows');
    const marker = await this.#readMarker();
    if (!marker) throw new Error('No signed update is staged');
    await this.#verifyInstaller(marker);
    const snapshotManifestPath = preparation?.snapshotManifestPath ? path.resolve(String(preparation.snapshotManifestPath)) : null;
    if (snapshotManifestPath && !inside(this.userDataDir, snapshotManifestPath)) throw new Error('Pre-update snapshot manifest must remain inside user data');
    const snapshotReceiptSha256 = preparation?.snapshotReceiptSha256 == null ? null : String(preparation.snapshotReceiptSha256);
    if (snapshotReceiptSha256 && !/^[a-f0-9]{64}$/.test(snapshotReceiptSha256)) throw new Error('Pre-update snapshot receipt is invalid');
    const recovery = {
      schema: 'nolane.agent.update-recovery.v1',
      state: 'installer-launched',
      previousVersion: this.currentVersion,
      targetVersion: marker.version,
      installerPath: marker.packagePath,
      installerSha256: marker.sha256,
      snapshotId: preparation?.snapshotId ? String(preparation.snapshotId) : null,
      snapshotManifestPath,
      snapshotReceiptSha256,
      migrationJournalReceiptSha256: /^[a-f0-9]{64}$/.test(String(preparation?.migrationJournalReceiptSha256 ?? '')) ? String(preparation.migrationJournalReceiptSha256) : null,
      preserveUserData: true,
      launchedAt: new Date().toISOString(),
    };
    const temp = `${this.recoveryPath}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(recovery, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(temp, this.recoveryPath);
    const child = this.spawnImpl(marker.packagePath, ['/S', '/UPDATED'], { detached: true, stdio: 'ignore', windowsHide: true });
    if (!child) throw new Error('Verified installer process did not start');
    if (typeof child.pid === 'number' && child.pid <= 0) throw new Error('Verified installer process did not start');
    child.unref?.();
    this.quit();
    return Object.freeze({ launched: true, version: marker.version });
  }

  async markHealthy() {
    let recovery;
    try { recovery = JSON.parse(await readFile(this.recoveryPath, 'utf8')); }
    catch (error) {
      if (error?.code === 'ENOENT') return Object.freeze({ state: 'no-recovery-record', preserveUserData: true });
      throw error;
    }
    if (recovery?.schema !== 'nolane.agent.update-recovery.v1') throw new Error('Update recovery record is invalid');
    if (recovery.targetVersion !== this.currentVersion) return Object.freeze({ state: recovery.state, targetVersion: recovery.targetVersion, preserveUserData: true });
    const healthy = { ...recovery, state: 'healthy', healthyAt: new Date().toISOString(), preserveUserData: true };
    const temp = `${this.recoveryPath}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(healthy, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(temp, this.recoveryPath);
    await rm(this.markerPath, { force: true });
    return Object.freeze(healthy);
  }
}

module.exports = { ElectronUpdateController };
