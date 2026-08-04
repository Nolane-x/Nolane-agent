#!/usr/bin/env node
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = require(path.resolve('electron-builder.config.cjs'));
if (process.platform !== 'win32' && process.env.NOLANE_ALLOW_CROSS_BUILD !== 'true') throw new Error('NSIS installer builds must run on a Windows runner');
const { build, Platform, Arch } = await import('electron-builder');
const results = await build({ targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), config, publish: 'never' });
process.stdout.write(`${JSON.stringify({ status: 'pass', artifacts: results.map(String) })}\n`);
