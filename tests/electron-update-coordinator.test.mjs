import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { DesktopUpdateCoordinator } = require('../desktop/update-coordinator.cjs');

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }

const VERIFIED_WINDOWS_TRUTH = Object.freeze({
  schema: 'nolane.desktop-update-platform-truth.v1',
  platform: 'win32', label: 'Windows', packageKinds: ['nsis'],
  updateTrust: { enabled: true, mechanism: 'signed-manifest' },
  inAppUpdateHandoff: { enabled: true, mechanism: 'runtime-stage' },
  nativeInstallHandoff: { enabled: true, mechanism: 'nsis' },
  recovery: { preUpdateSnapshot: true, migrationJournal: true, postUpdateHealth: true },
});

async function fixture(t, { autoDownload = false, runningMissions = [], platform = 'win32', verifiedWindows = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-update-coordinator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests = []; const states = []; const timers = [];
  let installed = false; let installedPreparation = null;
  const updateController = {
    status: async () => ({ ready: false, reason: 'no-staged-update' }),
    installAndRestart: async (preparation) => { installed = true; installedPreparation = preparation; return { launched: true, version: '0.0.1' }; }
  };
  const manifest = {
    schema: 'nolane.agent.update.v2', version: '0.0.1', signature: 'verified-by-runtime',
    release: { tag: 'v0.0.1', commit: 'a'.repeat(40), notesUrl: 'https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1' },
    package: { kind: 'nsis', name: 'NolaneAgent-Setup-0.0.1-x64.exe', bytes: 1234 }
  };
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    requests.push([pathname, options.method ?? 'GET', options.body ? JSON.parse(options.body) : null]);
    if (pathname === '/api/updates/check') return json({ available: true, manifest });
    if (pathname === '/api/updates/stage') return json({ version: manifest.version, bytes: manifest.package.bytes, releaseTag: manifest.release.tag, releaseCommit: manifest.release.commit, releaseNotesUrl: manifest.release.notesUrl, stagedAt: '2026-08-03T19:00:00.000Z' });
    if (pathname === '/api/updates/prepare') return json({ prepared: true, snapshotId: 'snapshot_1', snapshotReceiptSha256: 'e'.repeat(64) });
    if (pathname === '/api/settings/effective') return json({ value: { updates: { autoDownload, channel: 'stable' } } });
    if (pathname === '/api/missions') return json(runningMissions);
    return json({ error: 'not-found' }, 404);
  };
  const coordinator = new DesktopUpdateCoordinator({
    updateController, userDataDir: root, platform,
    getRuntimeConnection: () => ({ origin: 'http://127.0.0.1:1234', token: 'runtime-token' }), fetchImpl,
    emit: (state) => states.push(state), random: () => 0.5, now: () => '2026-08-03T19:00:00.000Z',
    setTimeoutImpl: (callback, delay) => { const timer = { callback, delay, unref() {} }; timers.push(timer); return timer; },
    clearTimeoutImpl: () => {}, initialDelayMinMs: 45_000, initialDelayMaxMs: 120_000,
    platformTruth: verifiedWindows && platform === 'win32' ? VERIFIED_WINDOWS_TRUTH : null
  });
  return { coordinator, requests, states, timers, manifest, installed: () => installed, installedPreparation: () => installedPreparation };
}

test('coordinator schedules checks after healthy startup and exposes no renderer URL or path parameters', async (t) => {
  const { coordinator, timers } = await fixture(t);
  const state = await coordinator.start();
  assert.equal(state.state, 'idle');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 82_500);
  assert.deepEqual(Object.keys(DesktopUpdateCoordinator.publicApiShape()).sort(), ['check', 'defer', 'download', 'getState', 'ignore', 'installAndRestart']);
  coordinator.stop();
});

test('coordinator projects authoritative Windows package and native install-handoff truth', async (t) => {
  const { coordinator } = await fixture(t, { platform: 'win32' });
  const state = await coordinator.start();
  assert.equal(state.platformTruth.schema, 'nolane.desktop-update-platform-truth.v1');
  assert.equal(state.platformTruth.platform, 'win32');
  assert.deepEqual(state.platformTruth.packageKinds, ['nsis']);
  assert.equal(state.platformTruth.inAppUpdateHandoff.enabled, false);
  assert.match(state.platformTruth.inAppUpdateHandoff.reason, /signing|evidence|verified/i);
  assert.equal(state.platformTruth.nativeInstallHandoff.enabled, true);
});

test('manual check retains the verified manifest internally and stages it without renderer input on Windows', async (t) => {
  const { coordinator, requests, manifest } = await fixture(t, { platform: 'win32', verifiedWindows: true });
  await coordinator.checkForUpdates({ manual: true });
  assert.equal(coordinator.state().state, 'available');
  assert.equal(coordinator.state().signatureVerified, true);
  assert.equal(coordinator.state().packageKind, 'nsis');
  await coordinator.downloadAvailableUpdate();
  assert.equal(coordinator.state().state, 'staged');
  const stage = requests.find(([pathname]) => pathname === '/api/updates/stage');
  assert.deepEqual(stage[2], { manifest });
});

test('macOS and Linux fail closed instead of staging a Windows NSIS handoff', async (t) => {
  for (const platform of ['darwin', 'linux']) {
    const { coordinator, requests } = await fixture(t, { platform });
    await coordinator.checkForUpdates({ manual: true });
    const result = await coordinator.downloadAvailableUpdate();
    assert.equal(result.state, 'handoffUnavailable');
    assert.equal(result.ready, false);
    assert.equal(result.platformTruth.inAppUpdateHandoff.enabled, false);
    assert.equal(result.platformTruth.nativeInstallHandoff.enabled, false);
    assert.equal(requests.some(([pathname]) => pathname === '/api/updates/stage'), false);
  }
});

test('auto-download does not create an in-flight promise cycle', async (t) => {
  const { coordinator, requests } = await fixture(t, { autoDownload: true, platform: 'win32', verifiedWindows: true });
  const result = await coordinator.checkForUpdates({ manual: false });
  assert.equal(result.state, 'staged');
  assert.equal(requests.filter(([pathname]) => pathname === '/api/updates/stage').length, 1);
});

test('installation is blocked while a mission is running and launches only after the runtime reports none', async (t) => {
  const blocked = await fixture(t, { runningMissions: [{ id: 'm1', status: 'running' }], platform: 'win32', verifiedWindows: true });
  await blocked.coordinator.checkForUpdates({ manual: true });
  await blocked.coordinator.downloadAvailableUpdate();
  const result = await blocked.coordinator.installUpdateAndRestart();
  assert.equal(result.state, 'blocked');
  assert.equal(result.activeMissionCount, 1);
  assert.equal(blocked.installed(), false);

  const clear = await fixture(t, { runningMissions: [], platform: 'win32', verifiedWindows: true });
  await clear.coordinator.checkForUpdates({ manual: true });
  await clear.coordinator.downloadAvailableUpdate();
  await clear.coordinator.installUpdateAndRestart();
  assert.equal(clear.installed(), true);
  assert.equal(clear.installedPreparation().snapshotId, 'snapshot_1');
  const prepare = clear.requests.find(([pathname]) => pathname === '/api/updates/prepare');
  assert.deepEqual(prepare[2], { targetVersion: '0.0.1' });
});
