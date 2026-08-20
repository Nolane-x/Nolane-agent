#!/usr/bin/env node
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = require(path.resolve('electron-builder.config.cjs'));
const requestedTarget = String(process.env.NOLANE_ELECTRON_TARGET ?? process.platform).toLowerCase();
const targets = {
  win32: { platform: 'win32', builder: 'WINDOWS', target: ['nsis'] },
  windows: { platform: 'win32', builder: 'WINDOWS', target: ['nsis'] },
  darwin: { platform: 'darwin', builder: 'MAC', target: ['dmg', 'zip'] },
  mac: { platform: 'darwin', builder: 'MAC', target: ['dmg', 'zip'] },
  linux: { platform: 'linux', builder: 'LINUX', target: ['AppImage', 'deb'] },
};
const selected = targets[requestedTarget];
if (!selected) throw new Error(`Unsupported Electron release target: ${requestedTarget}`);
if (process.platform !== selected.platform && process.env.NOLANE_ALLOW_CROSS_BUILD !== 'true') throw new Error(`${selected.builder} Electron builds must run on a native ${selected.platform} runner`);
const { build, Platform, Arch } = await import('electron-builder');
const results = await build({ targets: Platform[selected.builder].createTarget(selected.target, Arch.x64), config, publish: 'never' });
process.stdout.write(`${JSON.stringify({ status: 'pass', target: selected.platform, artifacts: results.map(String) })}\n`);
