import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';

import { canonicalJson } from '../src/update/canonical-json.mjs';
import { createSignedUpdateManifest, generateUpdateKeyPair } from '../scripts/update-release-tools.mjs';

function withoutSignature(manifest) {
  const { signature: _signature, ...unsigned } = manifest;
  return unsigned;
}

test('generateUpdateKeyPair writes an Ed25519 private key with restrictive permissions and a public key', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-keys-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await generateUpdateKeyPair({ outputDirectory: root, keyName: 'release' });

  assert.equal(result.algorithm, 'Ed25519');
  assert.match(await readFile(result.publicKeyPath, 'utf8'), /BEGIN PUBLIC KEY/);
  assert.match(await readFile(result.privateKeyPath, 'utf8'), /BEGIN PRIVATE KEY/);
  if (process.platform !== 'win32') assert.equal((await stat(result.privateKeyPath)).mode & 0o777, 0o600);
});

test('createSignedUpdateManifest binds version, channel, HTTPS package URL, bytes, and SHA-256 to an Ed25519 signature', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = path.join(root, 'ForgeStudio-0.3.1-update.zip');
  await writeFile(archive, Buffer.from('signed release payload'));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = path.join(root, 'private.pem');
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });

  const manifest = await createSignedUpdateManifest({
    packagePath: archive,
    packageUrl: 'https://updates.example/ForgeStudio-0.3.1-update.zip',
    version: '0.3.1',
    minimumLauncherVersion: '0.3.0',
    channel: 'stable',
    privateKeyPath,
    publishedAt: '2026-07-28T12:00:00.000Z',
  });

  const bytes = (await stat(archive)).size;
  const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
  assert.equal(manifest.schema, 'forge.studio.update.v1');
  assert.equal(manifest.package.bytes, bytes);
  assert.equal(manifest.package.sha256, digest);
  assert.equal(manifest.package.url, 'https://updates.example/ForgeStudio-0.3.1-update.zip');
  assert.equal(manifest.minimumLauncherVersion, '0.3.0');
  assert.equal(verify(null, Buffer.from(canonicalJson(withoutSignature(manifest))), publicKey, Buffer.from(manifest.signature, 'base64')), true);
});

test('createSignedUpdateManifest rejects insecure URLs and non-Ed25519 private keys', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = path.join(root, 'update.zip'); await writeFile(archive, 'x');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPath = path.join(root, 'rsa.pem');
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));

  await assert.rejects(() => createSignedUpdateManifest({ packagePath: archive, packageUrl: 'http://updates.example/update.zip', version: '0.3.1', minimumLauncherVersion: '0.3.0', channel: 'stable', privateKeyPath }), /HTTPS/i);
  await assert.rejects(() => createSignedUpdateManifest({ packagePath: archive, packageUrl: 'https://updates.example/update.zip', version: '0.3.1', minimumLauncherVersion: '0.3.0', channel: 'stable', privateKeyPath }), /Ed25519/i);
});

test('createSignedUpdateManifest v2 binds GitHub repository, tag, commit, NSIS installer, and release notes', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-update-v2-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installer = path.join(root, 'NolaneAgent-Setup-5.0.0-beta.1-x64.exe');
  await writeFile(installer, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(128, 7)]));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = path.join(root, 'private.pem');
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });

  const manifest = await createSignedUpdateManifest({
    packagePath: installer,
    packageUrl: 'https://github.com/casioreview20-glitch/nolane-agent/releases/download/v5.0.0-beta.1/NolaneAgent-Setup-5.0.0-beta.1-x64.exe',
    version: '5.0.0-beta.1',
    minimumLauncherVersion: '5.0.0-beta.1',
    channel: 'beta',
    privateKeyPath,
    schema: 'nolane.agent.update.v2',
    repository: 'casioreview20-glitch/nolane-agent',
    tag: 'v5.0.0-beta.1',
    commit: 'a'.repeat(40),
    packageKind: 'nsis',
    releaseNotesUrl: 'https://github.com/casioreview20-glitch/nolane-agent/releases/tag/v5.0.0-beta.1',
    publishedAt: '2026-08-01T08:00:00.000Z',
  });

  assert.equal(manifest.schema, 'nolane.agent.update.v2');
  assert.equal(manifest.repository, 'casioreview20-glitch/nolane-agent');
  assert.equal(manifest.release.tag, 'v5.0.0-beta.1');
  assert.equal(manifest.release.commit, 'a'.repeat(40));
  assert.equal(manifest.package.kind, 'nsis');
  assert.equal(manifest.package.name, path.basename(installer));
  assert.equal(manifest.release.notesUrl, 'https://github.com/casioreview20-glitch/nolane-agent/releases/tag/v5.0.0-beta.1');
  assert.equal(verify(null, Buffer.from(canonicalJson(withoutSignature(manifest))), publicKey, Buffer.from(manifest.signature, 'base64')), true);
});

test('v2 signed manifest rejects mismatched GitHub release paths and invalid commit hashes', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-update-v2-bad-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installer = path.join(root, 'NolaneAgent-Setup-5.0.0-beta.1-x64.exe');
  await writeFile(installer, Buffer.from('MZinstaller'));
  const { privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = path.join(root, 'private.pem');
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  const common = {
    packagePath: installer, version: '5.0.0-beta.1', minimumLauncherVersion: '5.0.0-beta.1', channel: 'beta', privateKeyPath,
    schema: 'nolane.agent.update.v2', repository: 'casioreview20-glitch/nolane-agent', tag: 'v5.0.0-beta.1', commit: 'b'.repeat(40), packageKind: 'nsis',
    releaseNotesUrl: 'https://github.com/casioreview20-glitch/nolane-agent/releases/tag/v5.0.0-beta.1',
  };
  await assert.rejects(() => createSignedUpdateManifest({ ...common, packageUrl: 'https://github.com/other/repo/releases/download/v5.0.0-beta.1/NolaneAgent-Setup-5.0.0-beta.1-x64.exe' }), /repository/i);
  await assert.rejects(() => createSignedUpdateManifest({ ...common, commit: 'not-a-sha', packageUrl: 'https://github.com/casioreview20-glitch/nolane-agent/releases/download/v5.0.0-beta.1/NolaneAgent-Setup-5.0.0-beta.1-x64.exe' }), /commit/i);
});
