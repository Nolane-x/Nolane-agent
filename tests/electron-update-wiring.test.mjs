import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Electron main wires the staged updater through trusted IPC and marks a successful startup healthy', async () => {
  const source = await read('desktop/main.cjs');
  assert.match(source, /ElectronUpdateController/);
  assert.match(source, /loadPackagedGitHubReleaseUpdater/);
  assert.match(source, /\['win32', 'darwin', 'linux'\]/);
  assert.match(source, /nolane:update-status/);
  assert.match(source, /nolane:update-install-and-restart/);
  assert.match(source, /safeSender\(event\)/);
  assert.match(source, /markHealthy\(\)/);
  assert.match(source, /app\.getVersion\(\)/);
  assert.match(source, /process\.argv\.includes\('--post-update'\)/);
  assert.match(source, /NOLANE_AGENT_POST_UPDATE/);
  assert.doesNotMatch(source, /ipcMain\.handle\([^\n]+packagePath/);
});

test('preload exposes a narrow update API without file or command parameters', async () => {
  const source = await read('desktop/preload.cjs');
  assert.match(source, /getUpdateStatus/);
  assert.match(source, /installStagedUpdate/);
  assert.match(source, /onUpdateState/);
  assert.match(source, /nolane:update-state/);
  assert.doesNotMatch(source, /spawn|exec|packagePath/);
});

test('renderer contains an accessible update notification and install action', async () => {
  const [html, workroom, css] = await Promise.all([read('ui/index.html'), read('ui/workroom.js'), read('ui/style.css')]);
  assert.match(html, /id="update-banner"/);
  assert.match(html, /role="status"/);
  assert.match(html, /id="install-update"/);
  assert.match(workroom, /installStagedUpdate/);
  assert.match(workroom, /onUpdateState/);
  assert.match(workroom, /autoCheckUpdate/);
  assert.match(css, /\.update-banner/);
  assert.match(css, /\.update-banner\[hidden\]/);
});


test('NSIS update contract relaunches only updater-initiated installations with a fixed post-update flag', async () => {
  const [installer, controller] = await Promise.all([read('build/installer.nsh'), read('desktop/update-controller.cjs')]);
  assert.match(installer, /GetOptions.*\/UPDATED/);
  assert.match(installer, /NolaneAgent\.exe.*--post-update/);
  assert.match(controller, /\['\/S', '\/UPDATED'\]/);
  assert.doesNotMatch(controller, /args\s*[,)]|renderer.*UPDATED/i);
});
