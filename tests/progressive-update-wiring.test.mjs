import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../ui-v3/shell/app-shell.mjs', import.meta.url), 'utf8');
const preload = fs.readFileSync(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');

test('progressive shell mounts one shared update surface in every experience level', () => {
  assert.match(shell, /id="update-notice-root"/);
  assert.match(shell, /renderUpdateNotice\(updateState,\{experience,language\}\)/);
  assert.match(app, /createUpdateStateController/);
  assert.match(app, /data-update-action/);
  assert.match(app, /updateStateController\.load\(\)/);
});

test('renderer update API never accepts a URL, installer path, manifest, or command', () => {
  for (const method of ['getUpdateState', 'checkForUpdates', 'downloadAvailableUpdate', 'deferUpdate', 'ignoreVersion', 'installUpdateAndRestart']) {
    assert.match(preload, new RegExp(`${method}: \\(\\) => electron\\.ipcRenderer\\.invoke`));
  }
  assert.doesNotMatch(preload, /checkForUpdates:\s*\([^)]/);
  assert.doesNotMatch(preload, /downloadAvailableUpdate:\s*\([^)]/);
  assert.doesNotMatch(preload, /installUpdateAndRestart:\s*\([^)]/);
  assert.match(main, /safeSender\(event\)/);
  assert.match(main, /updateCoordinator\.downloadAvailableUpdate\(\)/);
  assert.match(main, /updateCoordinator\.installUpdateAndRestart\(\)/);
});
