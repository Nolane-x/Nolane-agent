import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(file, 'utf8');

test('Electron main process uses utilityProcess and a secure BrowserWindow lifecycle', async () => {
  const main = await read('desktop/main.cjs');
  assert.match(main, /app\.enableSandbox\(\)/);
  assert.match(main, /utilityProcess\.fork/);
  assert.match(main, /new BrowserWindow/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /NOLANE_AGENT_ELECTRON_USER_DATA/);
  assert.match(main, /app\.setPath\('userData'/);
  assert.match(main, /NOLANE_AGENT_ELECTRON_RUNTIME_FILE/);
  assert.match(main, /installRuntimeAuthentication/);
  assert.match(main, /onBeforeSendHeaders/);
  assert.match(main, /Authorization/);
  assert.doesNotMatch(main, /\?token=/);
  assert.doesNotMatch(main, /nodeIntegration\s*:\s*true/);
});

test('Electron preload exposes only bounded named desktop operations', async () => {
  const preload = await read('desktop/preload.cjs');
  assert.match(preload, /contextBridge\.exposeInMainWorld\('nolaneDesktop'/);
  assert.match(preload, /selectDirectory/);
  assert.match(preload, /getDesktopInfo/);
  assert.doesNotMatch(preload, /ipcRenderer\s*[,}]/);
  assert.doesNotMatch(preload, /send\s*:\s*ipcRenderer\.send/);
});

test('project dialog uses the native Electron folder picker when available', async () => {
  const html = await read('ui/index.html');
  const app = await read('ui/app.js');
  assert.match(html, /id="browse-workspace"/);
  assert.match(app, /nolaneDesktop\?\.selectDirectory/);
  assert.match(app, /workspace-root/);
});

test('Electron keeps legacy desktop IPC and global names only in the migration adapter', async () => {
  const migration = await read('desktop/legacy-migration.cjs');
  assert.match(migration, /forgeDesktop/);
  assert.match(migration, /forge:select-directory/);
  const main = await read('desktop/main.cjs');
  const preload = await read('desktop/preload.cjs');
  assert.doesNotMatch(main, /forge:select-directory|forgeDesktop/);
  assert.doesNotMatch(preload, /forge:select-directory|forgeDesktop/);
});
