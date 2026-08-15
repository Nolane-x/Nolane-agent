import test from 'node:test';
import assert from 'node:assert/strict';

import { renderUpdateNotice } from '../ui-v3/components/update-notice/update-notice.mjs';

const windowsTruth = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1', platform: 'win32', label: 'Windows', packageKinds: ['nsis'],
  inAppUpdateHandoff: { enabled: true, mechanism: 'nolane-signed-nsis' },
  nativeInstallHandoff: { enabled: true, mechanism: 'nsis' },
});
const macTruth = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1', platform: 'darwin', label: 'macOS', packageKinds: ['dmg','zip'],
  inAppUpdateHandoff: { enabled: false, mechanism: null, reason: 'Native macOS update handoff is not yet verified.' },
  nativeInstallHandoff: { enabled: false, mechanism: null, reason: 'Native macOS update handoff is not yet verified.' },
});
const linuxTruth = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1', platform: 'linux', label: 'Linux', packageKinds: ['appimage','deb'],
  inAppUpdateHandoff: { enabled: false, mechanism: null, reason: 'Native Linux update handoff is not yet verified.' },
  nativeInstallHandoff: { enabled: false, mechanism: null, reason: 'Native Linux update handoff is not yet verified.' },
});

test('Everyday Windows staged update uses evidence-bounded preservation copy and update-and-restart action', () => {
  const html = renderUpdateNotice({ state: 'staged', version: '5.0.0-beta.7', ready: true, platformTruth: windowsTruth, packageKind: 'nsis' }, { experience: 'everyday', language: 'en' });
  assert.match(html, /role="status"/);
  assert.match(html, /Update and restart/);
  assert.match(html, /Before install|checkpoint|snapshot/i);
  assert.doesNotMatch(html, /conversations, settings, projects, and missions will be kept/i);
  assert.doesNotMatch(html, /Release evidence/);
});

test('macOS and Linux staged/package states never inherit Windows ready-to-install semantics', () => {
  for (const platformTruth of [macTruth, linuxTruth]) {
    const html = renderUpdateNotice({ state: 'staged', version: '5.0.0-beta.7', ready: false, platformTruth }, { experience: 'workspace', language: 'en' });
    assert.doesNotMatch(html, /Update and restart/);
    assert.doesNotMatch(html, /ready to install/i);
    assert.match(html, new RegExp(platformTruth.label));
    assert.match(html, /not yet verified|manual|release package/i);
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

test('unsupported native handoff is an explicit recoverable state rather than a generic install failure', () => {
  const html = renderUpdateNotice({ state: 'handoffUnavailable', version: '5.0.0-beta.7', platformTruth: macTruth, releaseNotesUrl: 'https://example.test/release' }, { experience: 'everyday', language: 'en' });
  assert.match(html, /macOS/);
  assert.match(html, /not yet verified|manual/i);
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
