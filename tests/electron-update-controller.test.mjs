import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ElectronUpdateController } = require('../desktop/update-controller.cjs');

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-electron-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const updates = path.join(root, 'updates');
  const fs = await import('node:fs/promises');
  await fs.mkdir(updates, { recursive: true });
  const installer = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 5)]);
  const installerPath = path.join(updates, 'NolaneAgent-Setup-5.0.0-beta.2-x64.exe');
  await writeFile(installerPath, installer);
  const markerPath = path.join(updates, 'pending-update.json');
  const marker = {
    schema: 'nolane.agent.pending-update.v2', version: '5.0.0-beta.2', packageKind: 'nsis',
    packageName: path.basename(installerPath), packagePath: installerPath,
    sha256: createHash('sha256').update(installer).digest('hex'), bytes: installer.length,
    releaseTag: 'v5.0.0-beta.2', releaseCommit: 'd'.repeat(40), stagedAt: new Date().toISOString(), healthTimeoutMs: 30_000,
    ...overrides,
  };
  await writeFile(markerPath, JSON.stringify(marker));
  return { root, updates, installer, installerPath, markerPath, marker };
}

test('controller validates the staged marker and launches only its signed NSIS installer', async (t) => {
  const data = await fixture(t);
  const launches = [];
  let quitCalled = false;
  const controller = new ElectronUpdateController({
    userDataDir: data.root,
    platform: 'win32',
    currentVersion: '5.0.0-beta.1',
    spawnImpl: (file, args, options) => { launches.push({ file, args, options }); return { unref() {} }; },
    quit: () => { quitCalled = true; },
  });

  const status = await controller.status();
  assert.equal(status.ready, true);
  assert.equal(status.version, '5.0.0-beta.2');
  const snapshotManifestPath = path.join(data.updates, 'snapshots', 'snapshot_1', 'snapshot-manifest.json');
  const result = await controller.installAndRestart({ snapshotId: 'snapshot_1', snapshotManifestPath, snapshotReceiptSha256: 'e'.repeat(64), migrationJournalReceiptSha256: 'f'.repeat(64) });
  assert.equal(result.launched, true);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].file, data.installerPath);
  assert.deepEqual(launches[0].args, ['/S', '/UPDATED']);
  assert.equal(launches[0].options.detached, true);
  assert.equal(quitCalled, true);
  const recovery = JSON.parse(await readFile(path.join(data.updates, 'update-recovery.json'), 'utf8'));
  assert.equal(recovery.state, 'installer-launched');
  assert.equal(recovery.targetVersion, '5.0.0-beta.2');
  assert.equal(recovery.snapshotId, 'snapshot_1');
  assert.equal(recovery.snapshotReceiptSha256, 'e'.repeat(64));
});

test('controller rejects marker escapes, tampered installers, wrong platform, and renderer supplied paths', async (t) => {
  const data = await fixture(t);
  const controller = new ElectronUpdateController({ userDataDir: data.root, platform: 'win32', currentVersion: '5.0.0-beta.1', spawnImpl: () => { throw new Error('must not launch'); }, quit() {} });
  await writeFile(data.installerPath, Buffer.from('MZtampered'));
  await assert.rejects(() => controller.installAndRestart(), /hash|byte count/i);

  const outside = path.join(data.root, '..', 'outside.exe');
  await writeFile(data.markerPath, JSON.stringify({ ...data.marker, packagePath: outside }));
  await assert.rejects(() => controller.status(), /updates directory/i);

  const nonWindows = new ElectronUpdateController({ userDataDir: data.root, platform: 'linux', currentVersion: '5.0.0-beta.1', spawnImpl() {}, quit() {} });
  await assert.rejects(() => nonWindows.installAndRestart(), /Windows/i);
  assert.equal('packagePath' in ElectronUpdateController.publicApiShape(), false);
});

test('controller marks a target version healthy after runtime startup and preserves user data', async (t) => {
  const data = await fixture(t);
  await writeFile(path.join(data.updates, 'update-recovery.json'), JSON.stringify({ schema: 'nolane.agent.update-recovery.v1', state: 'installer-launched', previousVersion: '5.0.0-beta.1', targetVersion: '5.0.0-beta.2', installerPath: data.installerPath }));
  const controller = new ElectronUpdateController({ userDataDir: data.root, platform: 'win32', currentVersion: '5.0.0-beta.2', spawnImpl() {}, quit() {} });
  const result = await controller.markHealthy();
  assert.equal(result.state, 'healthy');
  assert.equal(result.preserveUserData, true);
  assert.equal(JSON.parse(await readFile(path.join(data.updates, 'update-recovery.json'), 'utf8')).state, 'healthy');
});
