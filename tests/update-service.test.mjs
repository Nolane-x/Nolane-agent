import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';

import { canonicalJson } from '../src/update/canonical-json.mjs';
import { UpdateService, inspectZipEntries } from '../src/update/update-service.mjs';

function tinyZip(name = 'NolaneAgent.exe', content = Buffer.from('release')) {
  const file = Buffer.from(name);
  const body = Buffer.from(content);
  const local = Buffer.alloc(30 + file.length + body.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(file.length, 26); local.writeUInt16LE(0, 28);
  file.copy(local, 30); body.copy(local, 30 + file.length);
  const central = Buffer.alloc(46 + file.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(file.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt32LE(0, 38); central.writeUInt32LE(0, 42); file.copy(central, 46);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}

function signedManifest(privateKey, zip, overrides = {}) {
  const unsigned = {
    schema: 'nolane.agent.update.v1', channel: 'stable', version: '0.3.1', publishedAt: '2026-07-28T00:00:00.000Z', minimumLauncherVersion: '0.3.0',
    package: { url: 'https://updates.example/NolaneAgent-0.3.1.zip', bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex') }, ...overrides,
  };
  const signature = sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString('base64');
  return { ...unsigned, signature };
}

test('canonicalJson sorts object keys recursively and omits no signed values', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, { b: true, a: false }] } }), '{"a":{"x":[3,{"a":false,"b":true}],"y":2},"z":1}');
});

test('update service verifies Ed25519 manifest, stages a safe package, and writes a pending marker', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const zip = tinyZip(); const manifest = signedManifest(privateKey, zip);
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-')); t.after(() => rm(root, { recursive: true, force: true }));
  const fetchImpl = async (url) => new Response(url.endsWith('.zip') ? zip : JSON.stringify(manifest), { status: 200, headers: { 'content-type': url.endsWith('.zip') ? 'application/zip' : 'application/json' } });
  const service = new UpdateService({ currentVersion: '0.3.0', launcherVersion: '0.3.0', channel: 'stable', endpoint: 'https://updates.example/manifest.json', publicKey, dataDir: root, fetchImpl, maxPackageBytes: 1024 * 1024 });
  const available = await service.check(); assert.equal(available.available, true); assert.equal(available.manifest.version, '0.3.1');
  const staged = await service.stage(available.manifest); assert.equal(staged.version, '0.3.1');
  assert.ok((await stat(staged.packagePath)).isFile());
  const marker = JSON.parse(await readFile(staged.markerPath, 'utf8')); assert.equal(marker.version, '0.3.1'); assert.equal(marker.sha256, manifest.package.sha256);
});

test('update service rejects tampering, downgrade, hash mismatch, insecure URLs, oversized package, and ZIP traversal', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519'); const safe = tinyZip();
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-bad-')); t.after(() => rm(root, { recursive: true, force: true }));
  const base = signedManifest(privateKey, safe);
  const service = new UpdateService({ currentVersion: '0.3.0', launcherVersion: '0.3.0', channel: 'stable', endpoint: 'https://updates.example/manifest.json', publicKey, dataDir: root, fetchImpl: async () => new Response(safe), maxPackageBytes: safe.length + 10 });
  await assert.rejects(() => service.verifyManifest({ ...base, version: '9.9.9' }), /signature/i);
  await assert.rejects(() => service.verifyManifest(signedManifest(privateKey, safe, { version: '0.2.9' })), /newer/i);
  await assert.rejects(() => service.verifyManifest(signedManifest(privateKey, safe, { package: { ...base.package, url: 'http://updates.example/a.zip' } })), /HTTPS/i);
  await assert.rejects(() => service.stage({ ...base, package: { ...base.package, sha256: '0'.repeat(64) } }), /signature|hash/i);
  assert.throws(() => inspectZipEntries(tinyZip('../escape.exe')), /unsafe ZIP path/i);
  const large = tinyZip('NolaneAgent.exe', Buffer.alloc(2_048));
  const largeManifest = signedManifest(privateKey, large);
  const tooSmall = new UpdateService({ currentVersion: '0.3.0', launcherVersion: '0.3.0', channel: 'stable', endpoint: 'https://updates.example/manifest.json', publicKey, dataDir: root, fetchImpl: async () => new Response(large), maxPackageBytes: 1_024 });
  await assert.rejects(() => tooSmall.stage(largeManifest), /exceeds/i);
});

function signedNsisManifest(privateKey, installer, overrides = {}) {
  const unsigned = {
    schema: 'nolane.agent.update.v2',
    repository: 'casioreview20-glitch/nolane-agent',
    channel: 'beta',
    version: '5.0.0-beta.2',
    publishedAt: '2026-08-01T08:00:00.000Z',
    minimumLauncherVersion: '5.0.0-beta.1',
    release: {
      tag: 'v5.0.0-beta.2',
      commit: 'c'.repeat(40),
      notesUrl: 'https://github.com/casioreview20-glitch/nolane-agent/releases/tag/v5.0.0-beta.2',
    },
    package: {
      kind: 'nsis',
      name: 'NolaneAgent-Setup-5.0.0-beta.2-x64.exe',
      url: 'https://github.com/casioreview20-glitch/nolane-agent/releases/download/v5.0.0-beta.2/NolaneAgent-Setup-5.0.0-beta.2-x64.exe',
      bytes: installer.length,
      sha256: createHash('sha256').update(installer).digest('hex'),
    },
    ...overrides,
  };
  return { ...unsigned, signature: sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString('base64') };
}

test('update service verifies and stages a repository-bound NSIS installer', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const installer = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(256, 3)]);
  const manifest = signedNsisManifest(privateKey, installer);
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-nsis-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fetchImpl = async (url) => new Response(url.includes('/releases/download/') ? installer : JSON.stringify(manifest), { status: 200 });
  const service = new UpdateService({ currentVersion: '5.0.0-beta.1', launcherVersion: '5.0.0-beta.1', channel: 'beta', repository: 'casioreview20-glitch/nolane-agent', endpoint: 'https://github.com/casioreview20-glitch/nolane-agent/releases/latest/download/nolane-agent-update-beta.json', publicKey, dataDir: root, fetchImpl });

  const result = await service.check();
  assert.equal(result.available, true);
  const staged = await service.stage(result.manifest);
  assert.equal(staged.packageKind, 'nsis');
  assert.match(staged.packagePath, /NolaneAgent-Setup-5\.0\.0-beta\.2-x64\.exe$/);
  assert.deepEqual((await readFile(staged.packagePath)).subarray(0, 2), Buffer.from('MZ'));
  const marker = JSON.parse(await readFile(staged.markerPath, 'utf8'));
  assert.equal(marker.schema, 'nolane.agent.pending-update.v2');
  assert.equal(marker.releaseCommit, 'c'.repeat(40));
});

test('v2 update service rejects a different repository, invalid installer header, and non-GitHub release URL', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-nsis-bad-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const good = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);
  const service = new UpdateService({ currentVersion: '5.0.0-beta.1', launcherVersion: '5.0.0-beta.1', channel: 'beta', repository: 'casioreview20-glitch/nolane-agent', endpoint: 'https://github.com/casioreview20-glitch/nolane-agent/releases/latest/download/nolane-agent-update-beta.json', publicKey, dataDir: root, fetchImpl: async () => new Response(Buffer.from('NO')) });
  await assert.rejects(() => service.verifyManifest(signedNsisManifest(privateKey, good, { repository: 'other/repo' })), /repository/i);
  const badUrlManifest = signedNsisManifest(privateKey, good, { package: { ...signedNsisManifest(privateKey, good).package, url: 'https://example.com/update.exe' } });
  await assert.rejects(() => service.verifyManifest(badUrlManifest), /GitHub release/i);
  const invalidInstaller = Buffer.from('NO executable');
  const invalidManifest = signedNsisManifest(privateKey, invalidInstaller);
  await assert.rejects(() => service.stage(invalidManifest), /PE|MZ|installer/i);
});


test('NSIS staging streams chunks to disk, reports bounded progress, and atomically removes partial files', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const installer = Buffer.concat([Buffer.from('M'), Buffer.from('Z'), Buffer.alloc(1024, 7)]);
  const manifest = signedNsisManifest(privateKey, installer);
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-nsis-stream-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const progress = [];
  const chunks = [installer.subarray(0, 1), installer.subarray(1, 317), installer.subarray(317)];
  const fetchImpl = async () => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }), {
    status: 200,
    headers: { 'content-length': String(installer.length) }
  });
  const service = new UpdateService({ currentVersion: '5.0.0-beta.1', launcherVersion: '5.0.0-beta.1', channel: 'beta', repository: 'casioreview20-glitch/nolane-agent', endpoint: 'https://github.com/casioreview20-glitch/nolane-agent/releases/latest/download/nolane-agent-update-beta.json', publicKey, dataDir: root, fetchImpl });
  const staged = await service.stage(manifest, { onProgress: (event) => progress.push(event) });
  assert.equal(staged.bytes, installer.length);
  assert.equal(progress.at(-1).downloadedBytes, installer.length);
  assert.equal(progress.at(-1).progress, 1);
  assert.ok(progress.every((event) => event.progress >= 0 && event.progress <= 1));
  assert.deepEqual(await readFile(staged.packagePath), installer);
  assert.equal((await readdir(path.join(root, 'updates'))).some((name) => name.endsWith('.partial')), false);
});

test('streaming staging rejects declared-size mismatch and cancellation without leaving executable markers or partials', async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const installer = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(256, 5)]);
  const manifest = signedNsisManifest(privateKey, installer);
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-nsis-stream-fail-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const common = { currentVersion: '5.0.0-beta.1', launcherVersion: '5.0.0-beta.1', channel: 'beta', repository: 'casioreview20-glitch/nolane-agent', endpoint: 'https://github.com/casioreview20-glitch/nolane-agent/releases/latest/download/nolane-agent-update-beta.json', publicKey, dataDir: root };

  const wrongLength = new UpdateService({ ...common, fetchImpl: async () => new Response(installer, { status: 200, headers: { 'content-length': String(installer.length - 1) } }) });
  await assert.rejects(() => wrongLength.stage(manifest), /byte count mismatch/i);

  const aborter = new AbortController();
  const chunks = [installer.subarray(0, 64), installer.subarray(64)];
  const cancelled = new UpdateService({ ...common, fetchImpl: async () => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }), { status: 200 }) });
  await assert.rejects(() => cancelled.stage(manifest, { signal: aborter.signal, onProgress: () => aborter.abort() }), /cancelled|abort/i);
  const files = await readdir(path.join(root, 'updates')).catch(() => []);
  assert.equal(files.some((name) => name.endsWith('.partial') || name === 'pending-update.json'), false);
});
