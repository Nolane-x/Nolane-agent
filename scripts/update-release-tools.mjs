import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../src/update/canonical-json.mjs';
import { validateGitHubReleaseManifestFields } from '../src/update/github-release-policy.mjs';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CHANNELS = new Set(['stable', 'beta', 'nightly']);

function requireSemver(value, label) {
  const text = String(value ?? '');
  if (!SEMVER.test(text)) throw new TypeError(`${label} must be a semantic version`);
  return text;
}

function requireHttps(value, label) {
  const url = new URL(String(value ?? ''));
  if (url.protocol !== 'https:') throw new TypeError(`${label} must use HTTPS`);
  return url.href;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function generateUpdateKeyPair({ outputDirectory, keyName = 'forge-studio-update' } = {}) {
  const directory = path.resolve(String(outputDirectory ?? '.'));
  const safeName = String(keyName);
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(safeName)) throw new TypeError('keyName contains unsupported characters');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = path.join(directory, `${safeName}-private.pem`);
  const publicKeyPath = path.join(directory, `${safeName}-public.pem`);
  await writeFile(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), { flag: 'wx', mode: 0o600 });
  await writeFile(publicKeyPath, publicKey.export({ format: 'pem', type: 'spki' }), { flag: 'wx', mode: 0o644 });
  return Object.freeze({ algorithm: 'Ed25519', privateKeyPath, publicKeyPath });
}

export async function createSignedUpdateManifest({
  packagePath,
  packageUrl,
  version,
  minimumLauncherVersion,
  channel = 'stable',
  privateKeyPath,
  publishedAt = new Date().toISOString(),
  schema = 'forge.studio.update.v1',
  repository,
  tag,
  commit,
  packageKind = 'zip',
  releaseNotesUrl,
} = {}) {
  const archivePath = path.resolve(String(packagePath ?? ''));
  const archive = await readFile(archivePath);
  const info = await stat(archivePath);
  if (!info.isFile() || archive.length < 1) throw new Error('Update package must be a non-empty regular file');
  const selectedChannel = String(channel);
  if (!CHANNELS.has(selectedChannel)) throw new TypeError('Unsupported update channel');
  const validatedVersion = requireSemver(version, 'version');
  const validatedLauncherVersion = requireSemver(minimumLauncherVersion, 'minimumLauncherVersion');
  const validatedPackageUrl = requireHttps(packageUrl, 'packageUrl');
  const validatedPublishedAt = new Date(publishedAt).toISOString();
  const signingKey = createPrivateKey(await readFile(path.resolve(String(privateKeyPath ?? ''))));
  if (signingKey.asymmetricKeyType !== 'ed25519') throw new TypeError('Update signing key must be Ed25519');

  let unsigned;
  if (schema === 'nolane.agent.update.v2') {
    if (packageKind !== 'nsis') throw new TypeError('v2 update packageKind must be nsis');
    const release = validateGitHubReleaseManifestFields({
      repository,
      tag,
      commit,
      packageName: path.basename(archivePath),
      packageUrl: validatedPackageUrl,
      releaseNotesUrl,
    });
    unsigned = {
      schema,
      repository: release.repository,
      channel: selectedChannel,
      version: validatedVersion,
      publishedAt: validatedPublishedAt,
      minimumLauncherVersion: validatedLauncherVersion,
      release: {
        tag: release.tag,
        commit: release.commit,
        notesUrl: release.releaseNotesUrl,
      },
      package: {
        kind: 'nsis',
        name: release.packageName,
        url: release.packageUrl,
        bytes: archive.length,
        sha256: sha256(archive),
      },
    };
  } else {
    if (!['nolane.agent.update.v1', 'forge.studio.update.v1'].includes(schema)) throw new TypeError('Unsupported update manifest schema');
    unsigned = {
      schema,
      channel: selectedChannel,
      version: validatedVersion,
      publishedAt: validatedPublishedAt,
      minimumLauncherVersion: validatedLauncherVersion,
      package: {
        url: validatedPackageUrl,
        bytes: archive.length,
        sha256: sha256(archive),
      },
    };
  }
  const signature = sign(null, Buffer.from(canonicalJson(unsigned)), signingKey).toString('base64');
  return Object.freeze({ ...unsigned, signature });
}

function parseFlags(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) throw new Error(`Invalid argument sequence near ${key ?? '<end>'}`);
    values.set(key.slice(2), value);
  }
  return values;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const flags = parseFlags(rest);
  if (command === 'generate-keys') {
    const result = await generateUpdateKeyPair({ outputDirectory: flags.get('output'), keyName: flags.get('name') ?? 'forge-studio-update' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'sign-manifest') {
    const manifest = await createSignedUpdateManifest({
      packagePath: flags.get('package'), packageUrl: flags.get('url'), version: flags.get('version'),
      minimumLauncherVersion: flags.get('minimum-launcher'), channel: flags.get('channel') ?? 'stable',
      privateKeyPath: flags.get('private-key'), publishedAt: flags.get('published-at') ?? new Date().toISOString(),
      schema: flags.get('schema') ?? 'forge.studio.update.v1', repository: flags.get('repository'), tag: flags.get('tag'), commit: flags.get('commit'),
      packageKind: flags.get('package-kind') ?? 'zip', releaseNotesUrl: flags.get('release-notes-url'),
    });
    const output = path.resolve(String(flags.get('output') ?? 'update-manifest.json'));
    await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
    console.log(JSON.stringify({ output, version: manifest.version, bytes: manifest.package.bytes, sha256: manifest.package.sha256 }));
    return;
  }
  throw new Error('Usage: update-release-tools.mjs generate-keys --output <dir> [--name <name>] | sign-manifest --package <file> --url <https-url> --version <semver> --minimum-launcher <semver> --private-key <pem> [--channel stable] [--output manifest.json]');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
