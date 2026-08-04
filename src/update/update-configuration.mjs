import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { requireRepository, validateManifestEndpoint } from './github-release-policy.mjs';

const CHANNELS = new Set(['alpha', 'beta', 'stable', 'nightly']);

function envValue(environment, key) {
  return environment?.[`NOLANE_AGENT_${key}`] ?? environment?.[key] ?? null;
}

export async function loadPackagedUpdateConfiguration({ appRoot, environment = process.env } = {}) {
  const root = path.resolve(String(appRoot ?? '.'));
  const configDirectory = path.join(root, 'config');
  const configPath = path.join(configDirectory, 'update.json');
  let disk = {};
  try { disk = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) {
    if (error?.code === 'ENOENT') return Object.freeze({ enabled: false, reason: 'packaged-update-config-missing' });
    throw new Error(`Packaged update configuration is invalid: ${error.message}`);
  }
  if (disk.enabled === false) return Object.freeze({ enabled: false, reason: 'packaged-update-disabled' });
  const repository = requireRepository(envValue(environment, 'UPDATE_REPOSITORY') ?? disk.repository);
  const channel = String(envValue(environment, 'UPDATE_CHANNEL') ?? disk.channel ?? 'stable');
  if (!CHANNELS.has(channel)) throw new Error('Unsupported update channel');
  const endpoint = validateManifestEndpoint(envValue(environment, 'UPDATE_ENDPOINT') ?? disk.endpoint, repository);
  const publicKeyFile = String(envValue(environment, 'UPDATE_PUBLIC_KEY_FILE') ?? disk.publicKeyFile ?? '');
  if (!publicKeyFile || /private/i.test(publicKeyFile) || path.isAbsolute(publicKeyFile) || publicKeyFile.includes('..')) throw new Error('Update public key must be a relative public-key file inside config');
  const publicKeyPath = path.join(configDirectory, publicKeyFile);
  const publicKey = await readFile(publicKeyPath, 'utf8');
  if (!/BEGIN PUBLIC KEY/.test(publicKey) || /PRIVATE KEY/.test(publicKey)) throw new Error('Update public key file is invalid');
  return Object.freeze({ enabled: true, repository, channel, endpoint, publicKey, publicKeyPath, configPath });
}
