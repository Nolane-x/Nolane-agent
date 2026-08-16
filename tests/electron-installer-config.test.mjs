import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../electron-builder.config.cjs';

test('native desktop package identities and targets are stable and NolaneNative-free', async () => {
  assert.equal(config.appId, 'com.nolane.agent');
  assert.equal(config.productName, 'Nolane Agent');
  assert.equal(config.asar, true);
  assert.deepEqual(config.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(config.win.executableName, 'NolaneAgent');
  assert.equal(config.win.electronUpdaterCompatibility, '>=2.16');
  assert.equal(config.nsis.oneClick, false);
  assert.equal(config.nsis.perMachine, false);
  assert.equal(config.nsis.deleteAppDataOnUninstall, false);
  assert.equal(config.nsis.differentialPackage, true);
  assert.equal(config.nsis.guid, 'd4f38ef8-b26d-4fc8-9b83-31a988f96251');
  assert.match(config.artifactName, /NolaneAgent-Setup-\$\{version\}-\$\{arch\}\.\$\{ext\}/);
  assert.deepEqual(config.mac.target, [{ target: 'dmg', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }]);
  assert.match(config.mac.artifactName, /NolaneAgent-\$\{version\}-\$\{arch\}\.\$\{ext\}/);
  assert.deepEqual(config.linux.target, [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }]);
  assert.match(config.linux.artifactName, /NolaneAgent-\$\{version\}-\$\{arch\}\.\$\{ext\}/);
  assert.equal(config.win.icon, 'build/icon.ico');
  assert.equal(config.mac.icon, 'build/icon.png');
  assert.equal(config.linux.icon, 'build/icon.png');
  assert.ok(config.files.some((entry) => entry === '!vendor/nolane_native-agent/**'));
  assert.ok(config.files.some((entry) => entry === '!src/nolane_native/**'));
});

test('package pins Electron builder and updater versions for GitHub reproducibility', async () => {
  const metadata = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(config.electronVersion, '43.2.0');
  assert.equal(metadata.releaseToolchain['electron-builder'], '26.15.3');
  assert.equal(metadata.author?.name, 'Nolane Agent contributors');
  assert.match(metadata.author?.email ?? '', /@users\.noreply\.github\.com$/);
  assert.equal(metadata.repository?.url, 'git+https://github.com/Nolane-x/Nolane-agent.git');
  assert.equal(metadata.scripts['build:electron:installer'], 'node scripts/build-electron-installer.mjs');
  assert.equal(metadata.scripts['verify:electron-installer'], 'node scripts/verify-electron-installer-config.mjs');
});

test('native release builder refuses the wrong host and selects only declared platform targets', async () => {
  const source = await readFile('scripts/build-electron-installer.mjs', 'utf8');
  assert.match(source, /NOLANE_ELECTRON_TARGET/);
  assert.match(source, /darwin: \{ platform: 'darwin', builder: 'MAC', target: \['dmg', 'zip'\] \}/);
  assert.match(source, /linux: \{ platform: 'linux', builder: 'LINUX', target: \['AppImage', 'deb'\] \}/);
  assert.match(source, /must run on a native/);
});

test('electron-builder configuration does not export undefined optional values', () => {
  const undefinedPaths = [];
  const visit = (value, path = 'config') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (child === undefined) undefinedPaths.push(childPath);
      else visit(child, childPath);
    }
  };
  visit(config);
  assert.deepEqual(undefinedPaths, [], 'programmatic electron-builder config must omit optional fields instead of exporting undefined');
});
