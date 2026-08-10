import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stageElectronWindows } from '../scripts/build-electron.mjs';
import { VERSION } from '../src/version.mjs';

test('Electron staging creates a portable app with resources/app and excludes user data and tests', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-electron-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const electronDist = path.join(root, 'electron');
  await mkdir(path.join(electronDist, 'resources'), { recursive: true });
  await writeFile(path.join(electronDist, 'electron.exe'), 'PE');
  await writeFile(path.join(electronDist, 'chrome_100_percent.pak'), 'pak');
  await writeFile(path.join(electronDist, 'resources', 'default_app.asar'), 'default');
  const destination = path.join(root, 'out');
  const manifest = await stageElectronWindows({ sourceRoot: path.resolve('.'), electronDist, destination });
  assert.equal((await stat(path.join(destination, 'NolaneAgent.exe'))).isFile(), true);
  assert.equal((await stat(path.join(destination, 'resources', 'app', 'desktop', 'main.cjs'))).isFile(), true);
  assert.equal((await stat(path.join(destination, 'resources', 'app', 'src', 'app.mjs'))).isFile(), true);
  assert.equal((await stat(path.join(destination, 'resources', 'app', 'ui', 'index.html'))).isFile(), true);
  assert.equal((await stat(path.join(destination, 'resources', 'app', 'vendor', 'forge-os', 'src'))).isDirectory(), true);
  assert.equal((await stat(path.join(destination, 'resources', 'app', 'third_party', 'typescript', 'lib', 'typescript.js'))).isFile(), true);
  await assert.rejects(stat(path.join(destination, 'resources', 'app', 'tests')));
  await assert.rejects(stat(path.join(destination, 'resources', 'app', 'data')));
  await assert.rejects(stat(path.join(destination, 'resources', 'default_app.asar')));
  const packaged = JSON.parse(await readFile(path.join(destination, 'resources', 'app', 'package.json'), 'utf8'));
  assert.equal(packaged.main, 'desktop/main.cjs');
  assert.equal(packaged.version, VERSION);
  assert.equal(manifest.runtime.version, '43.2.0');
  assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test('Electron first-run installer pins version, SHA-256, HTTPS sources, and atomic extraction', async () => {
  const script = await readFile('scripts/install-electron-runtime.ps1', 'utf8');
  assert.match(script, /43\.2\.0/);
  assert.match(script, /eba5f5088af40ecb364fe258809c79a5234c6ece5a75c64722772eba01b02786/);
  assert.match(script, /github\.com\/electron\/electron\/releases\/download/);
  assert.match(script, /mirrors\.huaweicloud\.com\/electron/);
  assert.match(script, /Get-FileHash/);
  assert.match(script, /Expand-Archive/);
  assert.match(script, /Move-Item/);
  assert.doesNotMatch(script, /http:\/\//);
});

test('Electron recovery and project-picker copy follows the configured locale', async () => {
  const source = await readFile('desktop/main.cjs', 'utf8');
  assert.match(source, /NOLANE_AGENT_LOCALE/);
  assert.match(source, /desktopLanguage/);
  assert.match(source, /runtimeRecoveryTitle/);
  assert.match(source, /chooseProject/);
  assert.doesNotMatch(source, /<h1>Nolane Agent đang khôi phục runtime<\/h1>/);
});
