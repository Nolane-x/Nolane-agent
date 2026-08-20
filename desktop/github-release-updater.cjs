'use strict';

const path = require('node:path');
const { mkdir, rename, writeFile } = require('node:fs/promises');

function error(message, code) {
  const value = new Error(message);
  value.code = code;
  return value;
}

function normalizedVersion(value) {
  const version = String(value ?? '').replace(/^v/, '').trim();
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) return null;
  return { raw: version, numbers: match.slice(1, 4).map(Number), prerelease: match[4] ?? null };
}

function comparePrerelease(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const a = left.split('.'); const b = right.split('.');
  const count = Math.max(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    if (a[index] == null) return -1;
    if (b[index] == null) return 1;
    const numericA = /^\d+$/.test(a[index]); const numericB = /^\d+$/.test(b[index]);
    if (numericA && numericB) { const delta = Number(a[index]) - Number(b[index]); if (delta) return Math.sign(delta); continue; }
    if (numericA) return -1;
    if (numericB) return 1;
    const delta = a[index].localeCompare(b[index]); if (delta) return Math.sign(delta);
  }
  return 0;
}

function isNewer(candidate, current) {
  const a = normalizedVersion(candidate); const b = normalizedVersion(current);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index += 1) {
    const delta = a.numbers[index] - b.numbers[index];
    if (delta) return delta > 0;
  }
  return comparePrerelease(a.prerelease, b.prerelease) > 0;
}

function safeHttps(value) {
  try { const url = new URL(String(value ?? '')); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}

function updateDescriptor(info, repository) {
  const version = normalizedVersion(info?.version)?.raw;
  if (!version) return null;
  const releaseName = String(info?.releaseName ?? '').trim();
  const releaseTag = /^v\d+\.\d+\.\d+/.test(releaseName) ? releaseName : `v${version}`;
  const releaseNotesUrl = safeHttps(typeof info?.releaseNotes === 'string' ? info.releaseNotes : info?.releaseNotes?.url) ?? `https://github.com/${repository}/releases/tag/${releaseTag}`;
  return Object.freeze({
    version,
    releaseTag,
    releaseNotesUrl,
  });
}

class GitHubReleaseUpdater {
  constructor({ updater, app, currentVersion, platform = process.platform, userDataDir = null, repository = 'Nolane-x/Nolane-agent' } = {}) {
    if (!updater || typeof updater.on !== 'function' || typeof updater.checkForUpdates !== 'function' || typeof updater.downloadUpdate !== 'function' || typeof updater.quitAndInstall !== 'function') throw new TypeError('GitHubReleaseUpdater requires an electron-updater compatible updater');
    const version = normalizedVersion(currentVersion)?.raw;
    if (!version) throw new TypeError('GitHubReleaseUpdater requires a valid currentVersion');
    this.updater = updater;
    this.currentVersion = version;
    this.platform = String(platform);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repository))) throw new TypeError('GitHubReleaseUpdater repository is invalid');
    this.repository = String(repository);
    this.userDataDir = userDataDir ? path.resolve(String(userDataDir)) : null;
    this.recoveryPath = this.userDataDir ? path.join(this.userDataDir, 'updates', 'update-recovery.json') : null;
    this.enabled = app?.isPackaged === true;
    this.pending = null;
    this.downloaded = null;
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowPrerelease = version.includes('-');
    this.updater.on('update-available', (info) => { this.pending = updateDescriptor(info, this.repository); });
    this.updater.on('update-not-available', () => { this.pending = null; });
    this.updater.on('update-downloaded', (info) => { this.downloaded = updateDescriptor(info, this.repository) ?? this.pending; });
  }

  #assertEnabled() {
    if (!this.enabled) throw error('GitHub Releases updates require a packaged Nolane Agent application', 'github_release_updater_unavailable');
  }

  async status() {
    if (!this.enabled) return Object.freeze({ ready: false, reason: 'unpackaged-app' });
    if (!this.downloaded) return Object.freeze({ ready: false, reason: 'no-downloaded-update' });
    return Object.freeze({ ready: true, ...this.downloaded });
  }

  async check() {
    this.#assertEnabled();
    this.pending = null;
    const result = await this.updater.checkForUpdates();
    const candidate = this.pending ?? updateDescriptor(result?.updateInfo, this.repository);
    if (!candidate || !isNewer(candidate.version, this.currentVersion)) return Object.freeze({ available: false, version: this.currentVersion });
    this.pending = candidate;
    return Object.freeze({ available: true, ...candidate });
  }

  async download() {
    this.#assertEnabled();
    if (!this.pending) {
      const checked = await this.check();
      if (!checked.available) return Object.freeze({ ready: false, reason: 'up-to-date' });
    }
    await this.updater.downloadUpdate();
    const downloaded = this.downloaded ?? this.pending;
    if (!downloaded) throw error('electron-updater did not confirm a downloaded update', 'github_release_download_unconfirmed');
    this.downloaded = downloaded;
    return Object.freeze({ ready: true, ...downloaded });
  }

  async installAndRestart(preparation = null) {
    this.#assertEnabled();
    if (!this.downloaded) throw error('No downloaded GitHub Releases update is ready to install', 'github_release_update_not_ready');
    if (!this.recoveryPath) throw error('GitHub Releases update recovery path is unavailable', 'github_release_recovery_unavailable');
    const updatesDir = path.dirname(this.recoveryPath);
    await mkdir(updatesDir, { recursive: true, mode: 0o700 });
    const recovery = {
      schema: 'nolane.agent.update-recovery.v1',
      state: 'github-release-updater-launched',
      previousVersion: this.currentVersion,
      targetVersion: this.downloaded.version,
      installerPath: null,
      installerSha256: null,
      snapshotId: preparation?.snapshotId ? String(preparation.snapshotId) : null,
      snapshotManifestPath: preparation?.snapshotManifestPath ? String(preparation.snapshotManifestPath) : null,
      snapshotReceiptSha256: /^[a-f0-9]{64}$/.test(String(preparation?.snapshotReceiptSha256 ?? '')) ? String(preparation.snapshotReceiptSha256) : null,
      migrationJournalReceiptSha256: /^[a-f0-9]{64}$/.test(String(preparation?.migrationJournalReceiptSha256 ?? '')) ? String(preparation.migrationJournalReceiptSha256) : null,
      preserveUserData: true,
      launchedAt: new Date().toISOString(),
    };
    const temporary = `${this.recoveryPath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(recovery, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(temporary, this.recoveryPath);
    this.updater.quitAndInstall(false, true);
    return Object.freeze({ launched: true, version: this.downloaded.version });
  }
}

function loadPackagedGitHubReleaseUpdater({ app, currentVersion, platform = process.platform, updater = null, userDataDir = null, repository = 'Nolane-x/Nolane-agent' } = {}) {
  if (app?.isPackaged !== true) return null;
  let resolved = updater;
  if (!resolved) {
    try { resolved = require('electron-updater').autoUpdater; }
    catch { return null; }
  }
  try { return new GitHubReleaseUpdater({ updater: resolved, app, currentVersion, platform, userDataDir, repository }); }
  catch { return null; }
}

module.exports = Object.freeze({ GitHubReleaseUpdater, loadPackagedGitHubReleaseUpdater });
