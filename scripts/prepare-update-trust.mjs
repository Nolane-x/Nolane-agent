#!/usr/bin/env node
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireRepository } from '../src/update/github-release-policy.mjs';

const CHANNELS = new Set(['alpha', 'beta', 'stable', 'nightly']);

export async function prepareUpdateTrust({ privateKeyPath, outputDirectory = 'config', repository, channel = 'stable', enabled = true } = {}) {
  const selectedRepository = requireRepository(repository);
  const selectedChannel = String(channel);
  if (!CHANNELS.has(selectedChannel)) throw new TypeError('Unsupported update channel');
  const privatePath = path.resolve(String(privateKeyPath ?? ''));
  const privateKey = createPrivateKey(await readFile(privatePath));
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new TypeError('Update signing key must be Ed25519');
  const directory = path.resolve(String(outputDirectory));
  await mkdir(directory, { recursive: true });
  const publicKeyPath = path.join(directory, 'nolane-agent-update-public.pem');
  const configPath = path.join(directory, 'update.json');
  const publicPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
  const endpoint = `https://raw.githubusercontent.com/${selectedRepository}/update-feed/feeds/${selectedChannel}/nolane-agent-update-${selectedChannel}.json`;
  await writeFile(publicKeyPath, publicPem, { mode: 0o644 });
  await writeFile(configPath, `${JSON.stringify({ schema: 'nolane.agent.update-config.v1', enabled: Boolean(enabled), repository: selectedRepository, channel: selectedChannel, endpoint, publicKeyFile: path.basename(publicKeyPath) }, null, 2)}\n`, { mode: 0o644 });
  return Object.freeze({ publicKeyPath, configPath, repository: selectedRepository, channel: selectedChannel, endpoint });
}

function parseFlags(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) throw new Error(`Invalid arguments near ${key ?? '<end>'}`);
    values.set(key.slice(2), value);
  }
  return values;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const flags = parseFlags(process.argv.slice(2));
  prepareUpdateTrust({ privateKeyPath: flags.get('private-key'), outputDirectory: flags.get('output') ?? 'config', repository: flags.get('repository'), channel: flags.get('channel') ?? 'stable', enabled: flags.get('enabled') !== 'false' })
    .then((result) => process.stdout.write(`${JSON.stringify({ status: 'pass', ...result })}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
