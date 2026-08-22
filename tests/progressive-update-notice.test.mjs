import test from 'node:test';
import assert from 'node:assert/strict';

import { renderUpdateNotice } from '../ui-v3/components/update-notice/update-notice.mjs';

const windowsTruth = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1', platform: 'win32', label: 'Windows', packageKinds: ['nsis'],
  inAppUpdateHandoff: { enabled: true, mechanism: 'electron-updater-github' },
  nativeInstallHandoff: { enabled: true, mechanism: 'electron-updater-github' },
});
const macTruth = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1', platform: 'darwin', label: 'macOS', packageKinds: ['dmg','zip'],
  inAppUpdateHandoff: { enabled: true, mechanism: 'electron-updater-github' },
  nativeInstallHandoff: { enabled: true, mechanism: 'electron-updater-github' },
});
const linuxTruth = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1', platform: 'linux', label: 'Linux', packageKinds: ['appimage','deb'],
  inAppUpdateHandoff: { enabled: true, mechanism: 'electron-updater-github' },
  nativeInstallHandoff: { enabled: true, mechanism: 'electron-updater-github' },
});

test('Everyday Windows staged update uses evidence-bounded preservation copy and update-and-restart action', () => {
  const html = renderUpdateNotice({ state: 'staged', version: '5.0.0-beta.7', ready: true, platformTruth: windowsTruth, packageKind: 'nsis' }, { experience: 'everyday', language: 'en' });
  assert.match(html, /role="status"/);
  assert.match(html, /Update and restart/);
  assert.match(html, /Before install|checkpoint|snapshot/i);
  assert.doesNotMatch(html, /conversations, settings, projects, and missions will be kept/i);
  assert.doesNotMatch(html, /Release evidence/);
});

test('macOS and Linux surface the same explicit download and restart actions through GitHub Releases', () => {
  for (const platformTruth of [macTruth, linuxTruth]) {
    const available = renderUpdateNotice({ state: 'available', version: '5.0.0-beta.7', ready: false, platformTruth }, { experience: 'workspace', language: 'en' });
    const html = renderUpdateNotice({ state: 'staged', version: '5.0.0-beta.7', ready: true, integrityVerified: true, platformTruth }, { experience: 'workspace', language: 'en' });
    assert.match(available, /Download update/);
    assert.match(html, /Update and restart/);
    assert.match(html, /data-evidence-status="verified"/);
    assert.match(html, new RegExp(platformTruth.label));
  }
});

test('Workspace and Expert progressively disclose release metadata without fabricating package identity', () => {
  const state = {
    state: 'staged', version: '5.0.0-beta.7', releaseTag: 'v5.0.0-beta.7',
    releaseCommit: 'a'.repeat(40), packageName: 'NolaneAgent-Setup-5.0.0-beta.7-x64.exe', packageKind: 'nsis',
    packageBytes: 10485760, signatureVerified: true, platformTruth: windowsTruth
  };
  const workspace = renderUpdateNotice(state, { experience: 'workspace', language: 'en' });
  const expert = renderUpdateNotice(state, { experience: 'expert', language: 'en' });
  assert.match(workspace, /10 MB/);
  assert.match(workspace, /Signature verified/);
  assert.match(workspace, /Windows/);
  assert.doesNotMatch(workspace, /Release evidence/);
  assert.match(expert, /Release evidence/);
  assert.match(expert, /NolaneAgent-Setup-5\.0\.0-beta\.7-x64\.exe/);
  assert.match(expert, new RegExp('a'.repeat(40)));
  const noNameExpert = renderUpdateNotice({ ...state, packageName: null }, { experience: 'expert', language: 'en' });
  assert.doesNotMatch(noNameExpert, /staged NSIS/i);
  const availableExpert = renderUpdateNotice({ ...state, state: 'available' }, { experience: 'expert', language: 'en' });
  assert.match(availableExpert, /Ignore this version/);
});

test('an unavailable release updater is an explicit recoverable state rather than a generic install failure', () => {
  const unavailableTruth = Object.freeze({ ...macTruth, inAppUpdateHandoff: { enabled: false, mechanism: null, reason: 'Packaged GitHub Releases update engine is unavailable.' }, nativeInstallHandoff: { enabled: false, mechanism: null, reason: 'Packaged GitHub Releases update engine is unavailable.' } });
  const html = renderUpdateNotice({ state: 'handoffUnavailable', version: '5.0.0-beta.7', platformTruth: unavailableTruth, releaseNotesUrl: 'https://example.test/release' }, { experience: 'everyday', language: 'en' });
  assert.match(html, /macOS/);
  assert.match(html, /unavailable|manual/i);
  assert.doesNotMatch(html, /Try again/);
  assert.doesNotMatch(html, /Update and restart/);
  assert.match(html, /What’s new/);
});

test('available update offers safe download, later, and release-notes actions in Vietnamese on supported Windows handoff', () => {
  const html = renderUpdateNotice({
    state: 'available', version: '5.0.0-beta.7', releaseNotesUrl: 'https://example.test/release', platformTruth: windowsTruth
  }, { experience: 'everyday', language: 'vi' });
  assert.match(html, /Tải bản cập nhật/);
  assert.match(html, /Để sau/);
  assert.match(html, /Có gì mới/);
  assert.doesNotMatch(html, /sẽ được giữ nguyên/);
  const unsafe = renderUpdateNotice({ state: 'available', releaseNotesUrl: 'javascript:alert(1)', platformTruth: windowsTruth }, { experience: 'everyday', language: 'vi' });
  assert.doesNotMatch(unsafe, /href=/);
});

test('pending states expose aria-busy while idle, checking, up-to-date, deferred, and ignored states avoid persistent noise', () => {
  const pending = renderUpdateNotice({ state: 'downloading', version: '5.0.0-beta.7', platformTruth: windowsTruth }, { experience: 'everyday', language: 'en' });
  assert.match(pending, /aria-busy="true"/);
  for (const state of ['idle', 'checking', 'upToDate', 'deferred', 'ignored']) {
    assert.equal(renderUpdateNotice({ state, platformTruth: windowsTruth }, { experience: 'everyday', language: 'en' }), '');
  }
});

test('blocked install names the obstacle and offers a route to running missions instead of a deterministic retry loop', () => {
  const html = renderUpdateNotice({
    state: 'blocked', version: '5.0.0-beta.7', ready: true, activeMissionCount: 2,
    platformTruth: windowsTruth, packageKind: 'nsis'
  }, { experience: 'everyday', language: 'en' });
  assert.match(html, /2 missions? (?:is|are) running|2 mission/i);
  assert.match(html, /data-update-action="missions"/);
  assert.match(html, /View running missions/);
  assert.match(html, /Later/);
  assert.doesNotMatch(html, /data-update-action="install"/);
});

test('workspace update surface exposes a truthful qualitative evidence spine without fabricated progress percentages', () => {
  const html = renderUpdateNotice({
    state: 'installing', version: '5.0.0-beta.7', ready: true,
    platformTruth: windowsTruth, packageKind: 'nsis', signatureVerified: true,
    snapshotId: 'snap-17', snapshotReceiptSha256: 'b'.repeat(64), migrationJournalReceiptSha256: 'c'.repeat(64),
    preservation: { preparationStarted: true, snapshotPrepared: true, migrationJournalRecorded: true, postUpdateHealthy: false }
  }, { experience: 'workspace', language: 'en' });
  assert.match(html, /data-update-phase="install"/);
  assert.match(html, /data-update-severity="progress"/);
  assert.match(html, /class="update-notice__evidence"/);
  assert.match(html, /Release integrity/);
  assert.match(html, /Recovery snapshot/);
  assert.match(html, /Migration journal/);
  assert.match(html, /Install handoff/);
  assert.match(html, /data-evidence-status="verified"/);
  assert.match(html, /data-evidence-status="active"/);
  assert.doesNotMatch(html, /\b(?:10|25|50|75|90|100)%\b/);
});

test('failure detail uses a bounded alert region while the whole notice remains a polite status surface', () => {
  const html = renderUpdateNotice({
    state: 'downloadFailed', version: '5.0.0-beta.7', error: 'Network connection reset',
    platformTruth: windowsTruth, packageKind: 'nsis'
  }, { experience: 'workspace', language: 'en' });
  assert.match(html, /role="status"/);
  assert.match(html, /class="update-notice__error" role="alert"/);
  assert.match(html, /Network connection reset/);
  assert.match(html, /data-update-severity="error"/);
});
