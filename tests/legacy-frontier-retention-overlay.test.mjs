import test from 'node:test';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { prepareLegacyRetentionOverlay, runLegacyRetentionGate } from '../scripts/run-legacy-retention-gate.mjs';

const execFileAsync = promisify(execFile);

test('legacy frontier retention overlay pins the historical version without copying Git or Python caches', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-retention-source-'));
  const overlay = path.join(root, 'overlay');
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'config'), { recursive: true });
  await mkdir(path.join(root, 'extensions/vscode/extension'), { recursive: true });
  await mkdir(path.join(root, 'extensions/vscode'), { recursive: true });
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  await mkdir(path.join(root, 'sdk/python/__pycache__'), { recursive: true });
  const pkg = { name: 'nolane-agent', version: '5.0.0-alpha.2' };
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify(pkg)}\n`);
  await writeFile(path.join(root, 'package-lock.json'), `${JSON.stringify({ ...pkg, lockfileVersion: 3, packages: { '': pkg } })}\n`);
  await writeFile(path.join(root, 'config/product-identity.json'), `${JSON.stringify({ schema: 'nolane.agent.product-identity.v1', version: pkg.version, channel: 'alpha' })}\n`);
  await writeFile(path.join(root, 'config/release-identity.json'), `${JSON.stringify({ schema: 'nolane.agent.release-identity.v1', version: pkg.version, channel: 'alpha' })}\n`);
  await writeFile(path.join(root, 'extensions/vscode/extension/package.json'), `${JSON.stringify(pkg)}\n`);
  await writeFile(path.join(root, 'extensions/vscode/extension.vsixmanifest'), `<Identity Version="${pkg.version}" />\n`);
  await writeFile(path.join(root, 'src/example.mjs'), 'export const retained = true;\n');
  await writeFile(path.join(root, 'sdk/python/__pycache__/x.pyc'), 'not-exported\n');
  await writeFile(path.join(root, 'scripts/probe.mjs'), "import { execFile } from 'node:child_process'; import { readFile, access } from 'node:fs/promises'; import path from 'node:path'; import { promisify } from 'node:util'; const run=promisify(execFile); const root=process.argv[2]; const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')); if(pkg.version!=='4.0.0') process.exit(2); await access(path.join(root,'src/example.mjs')); try { await access(path.join(root,'.git/config')); process.exit(3); } catch {} try { await run('git',['rev-parse','--show-toplevel'],{cwd:root}); process.exit(4); } catch {}\n");

  const prepared = await prepareLegacyRetentionOverlay({ sourceRoot: root, retentionVersion: '4.0.0', overlayRoot: overlay });
  assert.equal(JSON.parse(await readFile(path.join(prepared, 'package.json'), 'utf8')).version, '4.0.0');
  await writeFile(path.join(prepared, 'src/example.mjs'), 'export const retained = false;\n');
  assert.equal(await readFile(path.join(root, 'src/example.mjs'), 'utf8'), 'export const retained = true;\n');
  await assert.rejects(readFile(path.join(prepared, '.git/config')));
  await assert.rejects(readFile(path.join(prepared, 'sdk/python/__pycache__/x.pyc')));
  const result = await runLegacyRetentionGate({ gateScript: 'scripts/probe.mjs', sourceRoot: root, retentionVersion: '4.0.0', overlayRoot: overlay });
  assert.equal(result.exitCode, 0);
});

test('legacy retention overlay accepts the current alpha beta rc prerelease identity guard', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-retention-prerelease-'));
  const overlay = path.join(root, 'overlay');
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'config'), { recursive: true });
  await mkdir(path.join(root, 'extensions/vscode/extension'), { recursive: true });
  await mkdir(path.join(root, 'src'), { recursive: true });
  const version = '5.0.0-beta.1';
  const pkg = { name: 'nolane-agent', version };
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify(pkg)}\n`);
  await writeFile(path.join(root, 'package-lock.json'), `${JSON.stringify({ ...pkg, lockfileVersion: 3, packages: { '': pkg } })}\n`);
  await writeFile(path.join(root, 'config/product-identity.json'), `${JSON.stringify({ schema: 'nolane.agent.product-identity.v1', version, channel: 'beta' })}\n`);
  await writeFile(path.join(root, 'config/release-identity.json'), `${JSON.stringify({ schema: 'nolane.agent.release-identity.v1', version, channel: 'beta' })}\n`);
  await writeFile(path.join(root, 'extensions/vscode/extension/package.json'), `${JSON.stringify(pkg)}\n`);
  await writeFile(path.join(root, 'extensions/vscode/extension.vsixmanifest'), `<Identity Version="${version}" />\n`);
  await writeFile(path.join(root, 'src/product-identity.mjs'), "if (!/^5\\.0\\.0-(?:alpha|beta|rc)\\.\\d+$/.test(parsed.version)) throw new Error('Nolane Agent prerelease version is invalid');\n");

  const prepared = await prepareLegacyRetentionOverlay({ sourceRoot: root, retentionVersion: '4.0.0', overlayRoot: overlay });
  const productIdentity = await readFile(path.join(prepared, 'src/product-identity.mjs'), 'utf8');
  assert.match(productIdentity, /Nolane Agent release version is invalid/);
  assert.doesNotMatch(productIdentity, /prerelease version is invalid/);
});
