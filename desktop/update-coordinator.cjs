'use strict';

const { UpdatePreferenceStore } = require('./update-preference-store.cjs');
const { resolveDesktopUpdatePlatformTruth, supportsPackageKind } = require('./update-platform-truth.cjs');

const DEFAULT_INTERVAL_MS = 8 * 60 * 60 * 1000;

function frozen(value) { return Object.freeze(structuredClone(value)); }
function asList(payload, key) { return Array.isArray(payload) ? payload : Array.isArray(payload?.[key]) ? payload[key] : []; }

class DesktopUpdateCoordinator {
  constructor({
    updateController, userDataDir, getRuntimeConnection, fetchImpl = globalThis.fetch,
    emit = () => {}, random = Math.random, now = () => new Date().toISOString(),
    setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout,
    initialDelayMinMs = 45_000, initialDelayMaxMs = 120_000, intervalMs = DEFAULT_INTERVAL_MS,
    preferenceStore = null, platform = process.platform, platformTruth = null, releaseUpdater = null
  } = {}) {
    if (!updateController?.status || !updateController?.installAndRestart) throw new TypeError('DesktopUpdateCoordinator requires ElectronUpdateController');
    if (typeof getRuntimeConnection !== 'function') throw new TypeError('DesktopUpdateCoordinator requires runtime connection resolver');
    if (typeof fetchImpl !== 'function') throw new TypeError('DesktopUpdateCoordinator requires fetch');
    this.updateController = updateController;
    this.getRuntimeConnection = getRuntimeConnection;
    this.fetchImpl = fetchImpl;
    this.emit = emit;
    this.random = random;
    this.now = now;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
    this.initialDelayMinMs = Math.max(0, Number(initialDelayMinMs) || 0);
    this.initialDelayMaxMs = Math.max(this.initialDelayMinMs, Number(initialDelayMaxMs) || this.initialDelayMinMs);
    this.intervalMs = Math.max(60_000, Number(intervalMs) || DEFAULT_INTERVAL_MS);
    this.preferences = preferenceStore ?? new UpdatePreferenceStore({ userDataDir, clock: now });
    this.platformTruth = platformTruth ?? resolveDesktopUpdatePlatformTruth(platform);
    if (releaseUpdater && (typeof releaseUpdater.status !== 'function' || typeof releaseUpdater.check !== 'function' || typeof releaseUpdater.download !== 'function' || typeof releaseUpdater.installAndRestart !== 'function')) throw new TypeError('DesktopUpdateCoordinator releaseUpdater contract is invalid');
    this.releaseUpdater = releaseUpdater;
    this.timer = null;
    this.inFlight = null;
    this.manifest = null;
    this.started = false;
    this.current = frozen({
      schema: 'nolane.desktop-update-state.v1', state: 'idle', ready: false, version: null, error: null, checkedAt: null,
      platformTruth: this.platformTruth,
      preservation: { preparationStarted: false, snapshotPrepared: false, migrationJournalRecorded: false, postUpdateHealthy: false }
    });
  }

  static publicApiShape() {
    return Object.freeze({
      getState: 'nolane:update-state-get', check: 'nolane:update-check', download: 'nolane:update-download',
      defer: 'nolane:update-defer', ignore: 'nolane:update-ignore', installAndRestart: 'nolane:update-install-and-restart'
    });
  }

  state() { return this.current; }

  #set(patch) {
    this.current = frozen({ ...this.current, ...patch, schema: 'nolane.desktop-update-state.v1', platformTruth: this.platformTruth });
    this.emit(this.current);
    return this.current;
  }

  #handoffUnavailable(patch = {}) {
    return this.#set({
      ...patch,
      state: 'handoffUnavailable',
      ready: false,
      error: null,
      handoffReason: patch.handoffReason ?? this.platformTruth.inAppUpdateHandoff?.reason ?? this.platformTruth.nativeInstallHandoff?.reason ?? 'Native update handoff is not verified for this platform.'
    });
  }

  #packageUnsupported(packageKind, patch = {}) {
    return this.#set({
      ...patch,
      state: 'packageUnsupported',
      ready: false,
      error: null,
      packageKind: packageKind ?? null,
      handoffReason: `Update package kind ${packageKind || 'unknown'} is not supported by the verified ${this.platformTruth.label} handoff.`
    });
  }

  #usesGitHubReleaseUpdater() { return this.platformTruth.inAppUpdateHandoff?.mechanism === 'electron-updater-github'; }

  #releasePackageKind() { return this.platformTruth.packageKinds?.[0] ?? null; }

  #releaseUpdaterUnavailable(patch = {}) {
    return this.#handoffUnavailable({
      ...patch,
      handoffReason: 'The packaged GitHub Releases update engine is unavailable for this application run.'
    });
  }

  #schedule(delay) {
    this.clearTimeoutImpl(this.timer);
    this.timer = this.setTimeoutImpl(() => {
      this.timer = null;
      this.checkForUpdates({ manual: false }).finally(() => this.#schedule(this.intervalMs + Math.round(this.intervalMs * 0.1 * this.random())));
    }, Math.max(0, delay));
    this.timer?.unref?.();
  }

  async #request(path, { method = 'GET', body } = {}) {
    const connection = this.getRuntimeConnection();
    if (!connection?.origin || !connection?.token) throw Object.assign(new Error('Nolane runtime is unavailable'), { code: 'update_runtime_unavailable' });
    const headers = { accept: 'application/json', authorization: `Bearer ${connection.token}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await this.fetchImpl(`${connection.origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload?.error ?? `Update request HTTP ${response.status}`), { code: payload?.code ?? 'update_request_failed', status: response.status });
    return payload;
  }

  async #effectiveUpdateSettings() {
    const effective = await this.#request('/api/settings/effective').catch(() => null);
    return frozen({ autoDownload: Boolean(effective?.value?.updates?.autoDownload), channel: effective?.value?.updates?.channel ?? null });
  }

  async #stageCurrentManifest() {
    const packageKind = this.manifest?.package?.kind ?? null;
    if (!this.platformTruth.inAppUpdateHandoff?.enabled) return this.#handoffUnavailable({ version: this.manifest?.version ?? this.current.version, packageKind });
    if (!supportsPackageKind(this.platformTruth, packageKind)) return this.#packageUnsupported(packageKind, { version: this.manifest?.version ?? this.current.version });
    this.#set({ state: 'downloading', ready: false, version: this.manifest.version, packageKind, error: null });
    try {
      const staged = await this.#request('/api/updates/stage', { method: 'POST', body: { manifest: this.manifest } });
      this.preferences.write({ deferredVersion: null });
      return this.#set({
        state: 'staged', ready: true, version: staged.version,
        releaseTag: staged.releaseTag ?? this.manifest.release?.tag ?? null,
        releaseCommit: staged.releaseCommit ?? this.manifest.release?.commit ?? null,
        releaseNotesUrl: staged.releaseNotesUrl ?? this.manifest.release?.notesUrl ?? null,
        packageName: this.manifest.package?.name ?? null,
        packageKind,
        packageBytes: staged.bytes ?? this.manifest.package?.bytes ?? null,
        signatureVerified: true, stagedAt: staged.stagedAt ?? this.now(), error: null
      });
    } catch (error) {
      return this.#set({ state: 'downloadFailed', ready: false, error: String(error?.message ?? error), errorCode: error?.code ?? 'update_download_failed' });
    }
  }

  async #stageGitHubReleaseUpdate() {
    if (!this.releaseUpdater) return this.#releaseUpdaterUnavailable({ version: this.current.version, packageKind: this.#releasePackageKind() });
    const packageKind = this.#releasePackageKind();
    this.#set({ state: 'downloading', ready: false, version: this.current.version, packageKind, error: null });
    try {
      const staged = await this.releaseUpdater.download();
      if (!staged?.ready) return this.#set({ state: 'upToDate', ready: false, version: staged?.version ?? this.current.version, reason: staged?.reason ?? 'up-to-date', error: null });
      this.preferences.write({ deferredVersion: null });
      return this.#set({
        state: 'staged', ready: true, version: staged.version,
        releaseTag: staged.releaseTag ?? null, releaseCommit: null, releaseNotesUrl: staged.releaseNotesUrl ?? null,
        packageName: null, packageKind, packageBytes: null,
        signatureVerified: false, integrityVerified: true, stagedAt: this.now(), error: null
      });
    } catch (error) {
      return this.#set({ state: 'downloadFailed', ready: false, error: String(error?.message ?? error), errorCode: error?.code ?? 'github_release_download_failed' });
    }
  }

  async #checkGitHubReleaseUpdates({ manual }) {
    if (!this.releaseUpdater) return this.#releaseUpdaterUnavailable();
    const result = await this.releaseUpdater.check();
    const checkedAt = this.now();
    const preferences = this.preferences.write({ lastCheckAt: checkedAt });
    if (!result?.available) return this.#set({ state: 'upToDate', ready: false, version: result?.version ?? null, reason: 'up-to-date', checkedAt, error: null });
    const shared = {
      version: result.version, releaseTag: result.releaseTag ?? null, releaseCommit: null, releaseNotesUrl: result.releaseNotesUrl ?? null,
      packageName: null, packageKind: this.#releasePackageKind(), packageBytes: null, signatureVerified: false, integrityVerified: false, checkedAt
    };
    if (preferences.ignoredVersion === result.version) return this.#set({ state: 'ignored', ready: false, ...shared, error: null });
    if (preferences.deferredVersion === result.version && !manual) return this.#set({ state: 'deferred', ready: false, ...shared, error: null });
    this.#set({ state: 'available', ready: false, ...shared, error: null });
    const settings = await this.#effectiveUpdateSettings();
    if (settings.autoDownload) return this.#stageGitHubReleaseUpdate();
    return this.state();
  }

  async start() {
    if (this.started) return this.state();
    this.started = true;
    const controller = this.#usesGitHubReleaseUpdater() ? this.releaseUpdater : this.updateController;
    const staged = await controller?.status().catch((error) => ({ ready: false, reason: 'staged-update-invalid', error: error.message }));
    if (staged.ready) {
      if (!this.platformTruth.nativeInstallHandoff?.enabled || !controller) {
        this.#handoffUnavailable({
          version: staged.version, releaseTag: staged.releaseTag ?? null, releaseCommit: staged.releaseCommit ?? null,
          releaseNotesUrl: staged.releaseNotesUrl ?? null, sourceState: 'staged',
          handoffReason: controller ? undefined : 'The packaged GitHub Releases update engine is unavailable for this application run.'
        });
      } else {
        this.#set({
          state: 'staged', ready: true, version: staged.version, releaseTag: staged.releaseTag, releaseCommit: staged.releaseCommit,
          releaseNotesUrl: staged.releaseNotesUrl, packageKind: this.#usesGitHubReleaseUpdater() ? this.#releasePackageKind() : this.platformTruth.nativeInstallHandoff.mechanism ?? this.platformTruth.packageKinds[0] ?? null,
          signatureVerified: this.#usesGitHubReleaseUpdater() ? false : true, integrityVerified: this.#usesGitHubReleaseUpdater(), error: null
        });
      }
    } else {
      this.#set({ state: 'idle', ready: false, error: staged.error ?? null });
      const span = this.initialDelayMaxMs - this.initialDelayMinMs;
      this.#schedule(this.initialDelayMinMs + Math.round(span * this.random()));
    }
    return this.state();
  }

  stop() {
    this.started = false;
    this.clearTimeoutImpl(this.timer);
    this.timer = null;
  }

  async checkForUpdates({ manual = true } = {}) {
    if (this.inFlight) return this.inFlight;
    this.inFlight = (async () => {
      this.#set({ state: 'checking', ready: false, error: null, manual: Boolean(manual) });
      try {
        if (this.#usesGitHubReleaseUpdater()) return await this.#checkGitHubReleaseUpdates({ manual });
        const result = await this.#request('/api/updates/check', { method: 'POST', body: {} });
        const checkedAt = this.now();
        const preferences = this.preferences.write({ lastCheckAt: checkedAt });
        if (!result.available) {
          this.manifest = null;
          return this.#set({ state: 'upToDate', ready: false, version: result.version ?? null, reason: result.reason ?? 'up-to-date', checkedAt, error: null });
        }
        this.manifest = result.manifest;
        const version = result.manifest.version;
        const release = result.manifest.release ?? {};
        const packageInfo = result.manifest.package ?? {};
        const packageKind = packageInfo.kind ?? null;
        const shared = {
          version, releaseTag: release.tag ?? null, releaseCommit: release.commit ?? null, releaseNotesUrl: release.notesUrl ?? null,
          packageName: packageInfo.name ?? null, packageKind, packageBytes: packageInfo.bytes ?? null, signatureVerified: true, checkedAt
        };
        if (!this.platformTruth.inAppUpdateHandoff?.enabled) return this.#handoffUnavailable(shared);
        if (!supportsPackageKind(this.platformTruth, packageKind)) return this.#packageUnsupported(packageKind, shared);
        if (preferences.ignoredVersion === version) return this.#set({ state: 'ignored', ready: false, ...shared, error: null });
        if (preferences.deferredVersion === version && !manual) return this.#set({ state: 'deferred', ready: false, ...shared, error: null });
        this.#set({ state: 'available', ready: false, ...shared, error: null });
        const settings = await this.#effectiveUpdateSettings();
        if (settings.autoDownload) return this.#stageCurrentManifest();
        return this.state();
      } catch (error) {
        return this.#set({ state: 'checkFailed', ready: false, error: String(error?.message ?? error), errorCode: error?.code ?? 'update_check_failed', checkedAt: this.now() });
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  async downloadAvailableUpdate() {
    if (this.inFlight) return this.inFlight;
    if (!this.platformTruth.inAppUpdateHandoff?.enabled) return this.#handoffUnavailable({ version: this.current.version, packageKind: this.current.packageKind ?? null });
    if (this.#usesGitHubReleaseUpdater()) {
      if (!this.releaseUpdater) return this.#releaseUpdaterUnavailable({ version: this.current.version, packageKind: this.#releasePackageKind() });
      if (this.current.state !== 'available') await this.checkForUpdates({ manual: true });
      if (this.current.state !== 'available') return this.state();
      this.inFlight = this.#stageGitHubReleaseUpdate().finally(() => { this.inFlight = null; });
      return this.inFlight;
    }
    if (!this.manifest) await this.checkForUpdates({ manual: true });
    if (!this.manifest) return this.state();
    this.inFlight = this.#stageCurrentManifest().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  deferUpdate() {
    if (!this.current.version) return this.state();
    this.preferences.write({ deferredVersion: this.current.version });
    return this.#set({ state: 'deferred', ready: false, error: null });
  }

  ignoreVersion() {
    if (!this.current.version) return this.state();
    this.preferences.write({ ignoredVersion: this.current.version });
    return this.#set({ state: 'ignored', ready: false, error: null });
  }

  async installUpdateAndRestart() {
    if (!this.platformTruth.nativeInstallHandoff?.enabled) return this.#handoffUnavailable({ version: this.current.version, packageKind: this.current.packageKind ?? null });
    if (!supportsPackageKind(this.platformTruth, this.current.packageKind ?? this.platformTruth.nativeInstallHandoff.mechanism)) {
      return this.#packageUnsupported(this.current.packageKind ?? null, { version: this.current.version });
    }
    const missions = asList(await this.#request('/api/missions?status=running').catch(() => []), 'missions');
    if (missions.length) return this.#set({ state: 'blocked', ready: true, blockReason: 'active-mission', activeMissionCount: missions.length, error: null });
    this.#set({
      state: 'preparingInstall', ready: true, error: null,
      preservation: { ...this.current.preservation, preparationStarted: true, snapshotPrepared: false, migrationJournalRecorded: false, postUpdateHealthy: false }
    });
    try {
      const preparation = await this.#request('/api/updates/prepare', { method: 'POST', body: { targetVersion: this.current.version } });
      const preservation = {
        preparationStarted: true,
        snapshotPrepared: Boolean(preparation.snapshotId && preparation.snapshotReceiptSha256),
        migrationJournalRecorded: Boolean(preparation.migrationJournalReceiptSha256),
        postUpdateHealthy: false
      };
      this.#set({
        state: 'installing', ready: true,
        snapshotId: preparation.snapshotId ?? null,
        snapshotReceiptSha256: preparation.snapshotReceiptSha256 ?? null,
        migrationJournalReceiptSha256: preparation.migrationJournalReceiptSha256 ?? null,
        preservation,
        error: null
      });
      const controller = this.#usesGitHubReleaseUpdater() ? this.releaseUpdater : this.updateController;
      if (!controller) return this.#releaseUpdaterUnavailable({ version: this.current.version, packageKind: this.current.packageKind ?? null });
      return await controller.installAndRestart(preparation);
    } catch (error) {
      this.#set({ state: 'installFailed', ready: true, error: String(error?.message ?? error), errorCode: error?.code ?? 'update_install_failed' });
      throw error;
    }
  }
}

module.exports = Object.freeze({ DesktopUpdateCoordinator });
