import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { DesktopUpdateCoordinator } = require('../desktop/update-coordinator.cjs');

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }

async function fixture(t, { autoDownload = false, runningMissions = [] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-update-coordinator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests = []; const states = []; const timers = [];
  let installed = false; let installedPreparation = null;
  const updateController = {
    status: async () => ({ ready: false, reason: 'no-staged-update' }),
    installAndRestart: async (preparation) => { installed = true; installedPreparation = preparation; return { launched: true, version: '5.0.0-beta.7' }; }
  };
  const manifest = {
    schema: 'nolane.agent.update.v2', version: '5.0.0-beta.7', signature: 'verified-by-runtime',
    release: { tag: 'v5.0.0-beta.7', commit: 'a'.repeat(40), notesUrl: 'https://github.com/nolane/agent/releases/tag/v5.0.0-beta.7' },
    package: { name: 'NolaneAgent-Setup-5.0.0-beta.7-x64.exe', bytes: 1234 }
  };
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    requests.push([pathname, options.method ?? 'GET', options.body ? JSON.parse(options.body) : null]);
    if (pathname === '/api/updates/check') return json({ available: true, manifest });
    if (pathname === '/api/updates/stage') return json({ version: manifest.version, bytes: manifest.package.bytes, releaseTag: manifest.release.tag, releaseCommit: manifest.release.commit, releaseNotesUrl: manifest.release.notesUrl, stagedAt: '2026-08-03T19:00:00.000Z' });
    if (pathname === '/api/updates/prepare') return json({ prepared: true, snapshotId: 'snapshot_1', snapshotReceiptSha256: 'e'.repeat(64) });
    if (pathname === '/api/settings/effective') return json({ value: { updates: { autoDownload, channel: 'beta' } } });
    if (pathname === '/api/missions') return json(runningMissions);
    return json({ error: 'not-found' }, 404);
  };
  const coordinator = new DesktopUpdateCoordinator({
    updateController, userDataDir: root, getRuntimeConnection: () => ({ origin: 'http://127.0.0.1:1234', token: 'runtime-token' }), fetchImpl,
    emit: (state) => states.push(state), random: () => 0.5, now: () => '2026-08-03T19:00:00.000Z',
    setTimeoutImpl: (callback, delay) => { const timer = { callback, delay, unref() {} }; timers.push(timer); return timer; },
    clearTimeoutImpl: () => {}, initialDelayMinMs: 45_000, initialDelayMaxMs: 120_000
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

test('manual check retains the verified manifest internally and stages it without renderer input', async (t) => {
  const { coordinator, requests, manifest } = await fixture(t);
  await coordinator.checkForUpdates({ manual: true });
  assert.equal(coordinator.state().state, 'available');
  assert.equal(coordinator.state().signatureVerified, true);
  await coordinator.downloadAvailableUpdate();
  assert.equal(coordinator.state().state, 'staged');
  const stage = requests.find(([pathname]) => pathname === '/api/updates/stage');
  assert.deepEqual(stage[2], { manifest });
});

test('auto-download does not create an in-flight promise cycle', async (t) => {
  const { coordinator, requests } = await fixture(t, { autoDownload: true });
  const result = await coordinator.checkForUpdates({ manual: false });
  assert.equal(result.state, 'staged');
  assert.equal(requests.filter(([pathname]) => pathname === '/api/updates/stage').length, 1);
});

test('installation is blocked while a mission is running and launches only after the runtime reports none', async (t) => {
  const blocked = await fixture(t, { runningMissions: [{ id: 'm1', status: 'running' }] });
  await blocked.coordinator.checkForUpdates({ manual: true });
  await blocked.coordinator.downloadAvailableUpdate();
  const result = await blocked.coordinator.installUpdateAndRestart();
  assert.equal(result.state, 'blocked');
  assert.equal(result.activeMissionCount, 1);
  assert.equal(blocked.installed(), false);

  const clear = await fixture(t, { runningMissions: [] });
  await clear.coordinator.checkForUpdates({ manual: true });
  await clear.coordinator.downloadAvailableUpdate();
  await clear.coordinator.installUpdateAndRestart();
  assert.equal(clear.installed(), true);
  assert.equal(clear.installedPreparation().snapshotId, 'snapshot_1');
  const prepare = clear.requests.find(([pathname]) => pathname === '/api/updates/prepare');
  assert.deepEqual(prepare[2], { targetVersion: '5.0.0-beta.7' });
});
