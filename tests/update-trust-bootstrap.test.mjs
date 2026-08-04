import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';

import { prepareUpdateTrust } from '../scripts/prepare-update-trust.mjs';
import { loadPackagedUpdateConfiguration } from '../src/update/update-configuration.mjs';

async function makeKey(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-trust-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = path.join(root, 'private.pem');
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  return { root, privateKeyPath };
}

test('prepareUpdateTrust derives only the public key and writes a signed-feed configuration', async (t) => {
  const { root, privateKeyPath } = await makeKey(t);
  const output = path.join(root, 'config');
  const result = await prepareUpdateTrust({ privateKeyPath, outputDirectory: output, repository: 'casioreview20-glitch/nolane-agent', channel: 'beta' });
  const publicPem = await readFile(result.publicKeyPath, 'utf8');
  assert.match(publicPem, /BEGIN PUBLIC KEY/);
  assert.doesNotMatch(publicPem, /PRIVATE KEY/);
  const config = JSON.parse(await readFile(result.configPath, 'utf8'));
  assert.equal(config.repository, 'casioreview20-glitch/nolane-agent');
  assert.equal(config.channel, 'beta');
  assert.equal(config.endpoint, 'https://raw.githubusercontent.com/casioreview20-glitch/nolane-agent/update-feed/feeds/beta/nolane-agent-update-beta.json');
  assert.equal(config.publicKeyFile, 'nolane-agent-update-public.pem');
  assert.equal(config.enabled, true);
});

test('packaged update configuration resolves public key relative to config and supports environment overrides', async (t) => {
  const { root, privateKeyPath } = await makeKey(t);
  const configRoot = path.join(root, 'config');
  await prepareUpdateTrust({ privateKeyPath, outputDirectory: configRoot, repository: 'casioreview20-glitch/nolane-agent', channel: 'beta' });
  const loaded = await loadPackagedUpdateConfiguration({ appRoot: root, environment: {} });
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.repository, 'casioreview20-glitch/nolane-agent');
  assert.match(loaded.publicKey, /BEGIN PUBLIC KEY/);

  const overridden = await loadPackagedUpdateConfiguration({ appRoot: root, environment: {
    NOLANE_AGENT_UPDATE_CHANNEL: 'stable',
    NOLANE_AGENT_UPDATE_ENDPOINT: 'https://raw.githubusercontent.com/casioreview20-glitch/nolane-agent/update-feed/feeds/stable/nolane-agent-update-stable.json',
  } });
  assert.equal(overridden.channel, 'stable');
  assert.match(overridden.endpoint, /feeds\/stable/);
});

test('packaged update configuration fails closed for missing key, private key references, and wrong repository feed', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-trust-bad-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configDir = path.join(root, 'config');
  const { mkdir } = await import('node:fs/promises'); await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, 'update.json'), JSON.stringify({ enabled: true, repository: 'owner/repo', channel: 'beta', endpoint: 'https://raw.githubusercontent.com/other/repo/update-feed/feeds/beta/nolane-agent-update-beta.json', publicKeyFile: 'private.pem' }));
  await assert.rejects(() => loadPackagedUpdateConfiguration({ appRoot: root, environment: {} }), /repository|private|public key/i);
});
