import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PlaywrightRuntimeInstaller } from '../src/browser/playwright-runtime-installer.mjs';

test('installs pinned Playwright CLI and Chromium atomically and returns a managed command', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-playwright-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const runProcess = async ({ executable, args, env }) => {
    calls.push({ executable, args: [...args], env: { ...env } });
    if (executable === 'npm') {
      const prefix = args[args.indexOf('--prefix') + 1];
      const packageRoot = path.join(prefix, 'node_modules', '@playwright', 'cli');
      await mkdir(packageRoot, { recursive: true });
      await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@playwright/cli', version: '0.1.17', bin: { 'playwright-cli': 'cli.js' } }));
      await writeFile(path.join(packageRoot, 'cli.js'), '#!/usr/bin/env node\n');
      await writeFile(path.join(prefix, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/@playwright/cli': { version: '0.1.17', integrity: 'sha512-test' } } }));
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (executable === process.execPath && args.includes('install-browser')) {
      await mkdir(env.PLAYWRIGHT_BROWSERS_PATH, { recursive: true });
      await writeFile(path.join(env.PLAYWRIGHT_BROWSERS_PATH, 'chromium.ready'), 'ok');
      return { exitCode: 0, stdout: 'installed chromium', stderr: '' };
    }
    if (executable === process.execPath && args.includes('--version')) return { exitCode: 0, stdout: 'Version 0.1.17', stderr: '' };
    return { exitCode: 1, stdout: '', stderr: 'unexpected' };
  };
  const installer = new PlaywrightRuntimeInstaller({ runtimeRoot: root, version: '0.1.17', runProcess });
  const installed = await installer.install();
  assert.equal(installed.ready, true);
  assert.equal(installed.version, '0.1.17');
  assert.equal(installed.command.executable, process.execPath);
  assert.match(installed.command.prefixArgs[0], /node_modules[\\/]@playwright[\\/]cli[\\/]cli\.js$/);
  assert.equal(calls[0].executable, 'npm');
  assert.ok(calls[0].args.includes('@playwright/cli@0.1.17'));
  assert.equal(calls[1].env.PLAYWRIGHT_BROWSERS_PATH.includes('staging'), true);
  const status = await installer.status();
  assert.equal(status.ready, true);
  assert.equal(status.installationId, installed.installationId);
  assert.match(await readFile(path.join(root, 'current.json'), 'utf8'), /0\.1\.17/);
});

test('failed browser installation leaves current runtime untouched and removes staging', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-playwright-runtime-fail-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runProcess = async ({ executable, args }) => {
    if (executable === 'npm') {
      const prefix = args[args.indexOf('--prefix') + 1];
      const packageRoot = path.join(prefix, 'node_modules', '@playwright', 'cli');
      await mkdir(packageRoot, { recursive: true });
      await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@playwright/cli', version: '0.1.17', bin: { 'playwright-cli': 'cli.js' } }));
      await writeFile(path.join(packageRoot, 'cli.js'), '');
      await writeFile(path.join(prefix, 'package-lock.json'), '{}');
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    return { exitCode: 1, stdout: '', stderr: 'browser download failed' };
  };
  const installer = new PlaywrightRuntimeInstaller({ runtimeRoot: root, version: '0.1.17', runProcess });
  await assert.rejects(() => installer.install(), /browser download failed/);
  const status = await installer.status();
  assert.equal(status.ready, false);
  await assert.rejects(() => readFile(path.join(root, 'current.json')), /ENOENT/);
});
