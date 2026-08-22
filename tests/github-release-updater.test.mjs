import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { GitHubReleaseUpdater } = require('../desktop/github-release-updater.cjs');

function updaterFixture({ version = '5.0.0-beta.7', releaseNotes = 'https://github.com/Nolane-x/Nolane-agent/releases/tag/v5.0.0-beta.7' } = {}) {
  const listeners = new Map();
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    on(event, listener) { listeners.set(event, listener); },
    async checkForUpdates() {
      const info = { version, releaseName: `v${version}`, releaseNotes };
      listeners.get('update-available')?.(info);
      return { updateInfo: info };
    },
    async downloadUpdate() {
      listeners.get('update-downloaded')?.({ version, releaseName: `v${version}`, releaseNotes });
      return ['NolaneAgent-update'];
    },
    quitAndInstall: (...args) => { updater.installArguments = args; },
  };
  return updater;
}

test('GitHub release updater uses packaged electron-updater metadata and only exposes a verified newer release', async (t) => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    const updater = updaterFixture();
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'nolane-github-release-updater-'));
    t.after(() => rm(userDataDir, { recursive: true, force: true }));
    const subject = new GitHubReleaseUpdater({
      updater,
      app: { isPackaged: true },
      currentVersion: '5.0.0-beta.6',
      platform,
      userDataDir,
    });

    assert.equal(updater.autoDownload, false);
    assert.equal(updater.autoInstallOnAppQuit, false);
    assert.equal(updater.allowPrerelease, true);
    assert.deepEqual(await subject.status(), { ready: false, reason: 'no-downloaded-update' });

    const result = await subject.check();
    assert.deepEqual(result, {
      available: true,
      version: '5.0.0-beta.7',
      releaseTag: 'v5.0.0-beta.7',
      releaseNotesUrl: 'https://github.com/Nolane-x/Nolane-agent/releases/tag/v5.0.0-beta.7',
    });

    const downloaded = await subject.download();
    assert.equal(downloaded.ready, true);
    assert.equal(downloaded.version, '5.0.0-beta.7');
    assert.equal(downloaded.releaseTag, 'v5.0.0-beta.7');
    assert.equal(downloaded.releaseNotesUrl, 'https://github.com/Nolane-x/Nolane-agent/releases/tag/v5.0.0-beta.7');

    await subject.installAndRestart();
    assert.deepEqual(updater.installArguments, [false, true]);
    const recovery = JSON.parse(await readFile(path.join(userDataDir, 'updates', 'update-recovery.json'), 'utf8'));
    assert.equal(recovery.state, 'github-release-updater-launched');
    assert.equal(recovery.targetVersion, '5.0.0-beta.7');
    assert.equal(recovery.preserveUserData, true);
  }
});

test('GitHub release updater remains unavailable in an unpackaged source run', async () => {
  const subject = new GitHubReleaseUpdater({
    updater: updaterFixture(),
    app: { isPackaged: false },
    currentVersion: '5.0.0-beta.6',
    platform: 'linux',
  });

  assert.deepEqual(await subject.status(), { ready: false, reason: 'unpackaged-app' });
  await assert.rejects(subject.check(), /packaged/i);
});
