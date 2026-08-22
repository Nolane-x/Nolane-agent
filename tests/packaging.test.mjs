import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildPortable } from '../scripts/build-portable.mjs';
import { VERSION } from '../src/version.mjs';

test('buildPortable stages a dependency-free app, Nolane Agent Core data, UI, runtime, and launch metadata', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-package-')); t.after(() => rm(root, { recursive: true, force: true }));
  const fakeNode = path.join(root, process.platform === 'win32' ? 'node.exe' : 'node');
  await writeFile(fakeNode, '#!/bin/sh\nexit 0\n'); await chmod(fakeNode, 0o755);
  const fakeLauncher = path.join(root, 'NolaneAgent');
  await writeFile(fakeLauncher, 'launcher'); await chmod(fakeLauncher, 0o755);
  const fakePty = path.join(root, 'NolanePty'); const fakeCredential = path.join(root, 'NolaneCredential');
  await writeFile(fakePty, 'pty'); await writeFile(fakeCredential, 'credential'); await chmod(fakePty, 0o755); await chmod(fakeCredential, 0o755);
  const destination = path.join(root, 'portable');
  const manifest = await buildPortable({ sourceRoot: path.resolve('.'), destination, nodeExecutable: fakeNode, launcherExecutable: fakeLauncher, ptyExecutable: fakePty, credentialExecutable: fakeCredential, platform: 'linux' });
  for (const relative of ['app/src/app.mjs', 'app/src/release/evidence-file-hash.mjs', 'app/desktop/main.cjs', 'app/ui/index.html', 'app/vendor/forge-os/src/core/orchestrator.mjs', 'app/third_party/typescript/lib/typescript.js', 'app/third_party/typescript/LICENSE.txt', 'app/config/model-families.json', 'app/vendor/forge-os/capabilities-v2/graph.json', 'runtime/node', 'NolaneAgent', 'app/native/NolanePty', 'app/native/NolaneCredential', 'config/update.example.json', 'PORTABLE-MANIFEST.json']) {
    assert.ok((await stat(path.join(destination, relative))).isFile(), relative);
  }
  await assert.rejects(() => stat(path.join(destination, 'app/tests')), /ENOENT/);
  await assert.rejects(() => stat(path.join(destination, 'app/src/native-core/nolane-native-domain-classifier.mjs')), /ENOENT/);
  await assert.rejects(() => stat(path.join(destination, 'app/src/release/nolane-native-core-inventory-verifier.mjs')), /ENOENT/);
  assert.equal(manifest.files.some((file) => /nolane_native-domain-classifier|nolane_native-core-inventory-verifier/i.test(file.path)), false);
  assert.ok((await stat(path.join(destination, 'app/src/release/dependency-preflight-service.mjs'))).isFile());
  assert.equal(manifest.product, 'Nolane Agent');
  assert.equal(manifest.version, VERSION);
  assert.match(manifest.files.find((file) => file.path === 'app/src/app.mjs').sha256, /^[a-f0-9]{64}$/);
  assert.ok(manifest.files.some((file) => file.path === 'NolaneAgent'));
});

test('native launcher starts the Electron shell, waits for runtime health, and preserves update rollback', async () => {
  const source = await readFile('launcher/main.go', 'utf8');
  for (const marker of ['NOLANE_AGENT_ELECTRON_RUNTIME_FILE', 'nolane-agent.lock', 'newElectronCommand', 'cmd.Wait()', 'os.Remove(lockPath)', 'prepareAppSelection', 'Finalize(false)']) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const windows = await readFile('launcher/process_windows.go', 'utf8');
  assert.match(windows, /windowsHide|HideWindow|CREATE_NEW_PROCESS_GROUP/);
});

test('Windows bootstrap package installs and verifies the pinned Electron runtime when it is not pre-bundled', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-bootstrap-')); t.after(() => rm(root, { recursive: true, force: true }));
  const destination = path.join(root, 'portable');
  const manifest = await buildPortable({ sourceRoot: path.resolve('.'), destination, nodeExecutable: null, platform: 'win32' });
  const script = await readFile(path.join(destination, 'Install-Electron-Runtime.ps1'), 'utf8');
  assert.match(script, /electron-v43\.2\.0-win32-x64\.zip/);
  assert.match(script, /eba5f5088af40ecb364fe258809c79a5234c6ece5a75c64722772eba01b02786/);
  assert.match(script, /Get-FileHash/);
  assert.equal(manifest.runtime.name, 'Electron');
  assert.equal(manifest.runtime.bundled, false);
});

test('native launcher bootstraps a pinned Electron runtime before starting the desktop shell', async () => {
  const source = `${await readFile('launcher/main.go', 'utf8')}\n${await readFile('launcher/electron_runtime.go', 'utf8')}`;
  for (const marker of ['ensureElectronRuntime', 'Install-Electron-Runtime.ps1', 'electronVersion']) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Windows build script falls back to a verified first-run runtime bootstrap when downloads are unavailable', async () => {
  const source = await readFile('scripts/build-windows.sh', 'utf8');
  assert.match(source, /ELECTRON_MODE="bootstrap"/);
  assert.match(source, /launcherExecutable/);
  assert.match(source, /ptyExecutable/);
  assert.match(source, /credentialExecutable/);
  assert.match(source, /NolanePty\.exe/);
  assert.match(source, /NolaneCredential\.exe/);
  assert.match(source, /stage-update-payload\.mjs/);
  assert.match(source, /electronRuntimeBundled: false/);
});

test('staged portable application starts with the complete Nolane Agent Core runtime dependency closure', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-staged-smoke-')); t.after(() => rm(root, { recursive: true, force: true }));
  const destination = path.join(root, 'portable');
  await buildPortable({ sourceRoot: path.resolve('.'), destination, nodeExecutable: process.execPath, platform: process.platform });
  const runtimeFile = path.join(root, 'runtime.json');
  const { spawn } = await import('node:child_process');
  const child = spawn(path.join(destination, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'), [path.join(destination, 'app', 'src', 'app.mjs')], {
    cwd: path.join(destination, 'app'), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, NOLANE_AGENT_HOST: '127.0.0.1', NOLANE_AGENT_PORT: '0', NOLANE_AGENT_DATA_DIR: path.join(root, 'data'), NOLANE_AGENT_WORKSPACE: root, NOLANE_AGENT_RUNTIME_FILE: runtimeFile },
  });
  let exited = false;
  child.once('exit', () => { exited = true; });
  t.after(() => { if (!exited) child.kill('SIGTERM'); });
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk; });
  // This closure test runs after hundreds of isolated files in the full suite.
  // Keep the product readiness requirement intact, but allow a constrained CI host
  // enough time to initialize the complete local runtime graph.
  const deadline = Date.now() + 120_000; let runtime; let healthStatus = null;
  while (Date.now() < deadline) {
    try {
      runtime = JSON.parse(await readFile(runtimeFile, 'utf8'));
      healthStatus = (await fetch(`${runtime.url}/health`, { signal: AbortSignal.timeout(500) })).status;
      if (healthStatus === 200) break;
    } catch {}
    if (exited) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(runtime, `staged app failed to publish runtime metadata within 120000ms (exit=${exited ? 'exited' : 'running'}): ${stderr}`);
  assert.equal(healthStatus, 200, `staged app health check failed: ${stderr}`);
  const waitForExit = (timeoutMs) => exited
    ? Promise.resolve(true)
    : Promise.race([
        new Promise((resolve) => child.once('exit', () => resolve(true))),
        new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
  if (!exited) child.kill('SIGTERM');
  if (!await waitForExit(10_000) && !exited) child.kill('SIGKILL');
  assert.equal(await waitForExit(10_000), true, 'staged app process did not terminate');
});
