import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadReleaseNaming, releaseArtifactNames } from './release-naming.mjs';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'release', '.cache', 'coverage', '.forgeos-data', 'dist']);
const REQUIRED_MODULES = Object.freeze(['src/core/canonical-json.mjs', 'src/core/orchestrator.mjs']);

export async function resolveSourceReconstructionPlan({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const naming = await loadReleaseNaming({ rootDirectory: root });
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(releaseVersion)) throw new TypeError('A semantic release version is required');
  const releaseManifestPath = path.join(root, 'release', `release-manifest-${releaseVersion}.json`);
  const releaseManifest = JSON.parse(await readFile(releaseManifestPath, 'utf8'));
  if (releaseManifest.schema !== naming.manifestSchema || releaseManifest.version !== releaseVersion) throw new Error('Source reconstruction release manifest is invalid');
  const ownership = releaseManifest.runtimeOwnership;
  if (!ownership || ownership.product !== 'Nolane Agent' || ownership.runtime !== 'nolane-native' || ownership.externalRuntimeBundled !== false || ownership.externalExecutablePaths !== 0) throw new Error('Nolane runtime ownership must be verified before source reconstruction');
  const names = releaseArtifactNames(naming, releaseVersion);
  const artifact = (releaseManifest.artifacts ?? []).find((entry) => entry.fileName === names.sourceArchive);
  if (!artifact || !/^[a-f0-9]{64}$/.test(String(artifact.sha256 ?? '')) || !Number.isInteger(Number(artifact.bytes))) throw new Error('Source reconstruction source artifact metadata is invalid');
  const archivePath = path.join(root, 'release', names.sourceArchive);
  const content = await readFile(archivePath);
  if (content.length !== Number(artifact.bytes) || sha256(content) !== String(artifact.sha256)) throw new Error('Source reconstruction source artifact identity mismatch');
  return Object.freeze({ mode: 'nolane-runtime-pure', sourceArtifact: names.sourceArchive, archivePath, archiveSha256: artifact.sha256, archiveBytes: artifact.bytes, runtimeOwnership: ownership, runtimePurityVerified: true });
}



function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function walk(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function normalize(relative) {
  return String(relative).replaceAll('\\', '/').replace(/^\.\//, '');
}

function rootDigest(files) {
  const material = files.map((entry) => `${entry.relativePath}\0${entry.bytes}\0${entry.sha256}\n`).join('');
  return sha256(material);
}

export async function createForgeOsVendorManifest(rootDirectory = process.cwd(), { write = true } = {}) {
  const root = path.resolve(rootDirectory);
  const vendorRoot = path.join(root, 'vendor', 'forge-os');
  await access(path.join(vendorRoot, 'package.json'));
  const files = [];
  for (const absolute of (await walk(vendorRoot)).sort()) {
    const relativePath = normalize(path.relative(vendorRoot, absolute));
    const content = await readFile(absolute);
    const info = await stat(absolute);
    files.push(Object.freeze({ relativePath, bytes: info.size, sha256: sha256(content) }));
  }
  const packageMetadata = JSON.parse(await readFile(path.join(vendorRoot, 'package.json'), 'utf8'));
  const manifest = Object.freeze({
    schema: 'forge.vendor-manifest.v1',
    component: 'ForgeOS',
    version: String(packageMetadata.version ?? 'unknown'),
    algorithm: 'sha256',
    excludedDirectories: Object.freeze([...EXCLUDED_DIRS].sort()),
    requiredModules: REQUIRED_MODULES,
    files: Object.freeze(files),
    rootSha256: rootDigest(files),
  });
  if (write) await writeFile(path.join(root, 'vendor', 'forge-os.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  return manifest;
}

export async function verifyForgeOsVendor(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const manifestPath = path.join(root, 'vendor', 'forge-os.manifest.json');
  const vendorRoot = path.join(root, 'vendor', 'forge-os');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schema !== 'forge.vendor-manifest.v1' || manifest.algorithm !== 'sha256' || !Array.isArray(manifest.files)) {
    throw new Error('ForgeOS vendor manifest is invalid');
  }
  const seen = new Set();
  for (const raw of manifest.files) {
    const relativePath = normalize(raw.relativePath);
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath) || seen.has(relativePath)) throw new Error(`Invalid ForgeOS vendor manifest path: ${relativePath}`);
    seen.add(relativePath);
    const absolute = path.join(vendorRoot, relativePath);
    const content = await readFile(absolute);
    const info = await stat(absolute);
    if (info.size !== Number(raw.bytes)) throw new Error(`ForgeOS vendor byte count mismatch: ${relativePath}`);
    if (sha256(content) !== String(raw.sha256)) throw new Error(`ForgeOS vendor checksum mismatch: ${relativePath}`);
  }
  for (const required of REQUIRED_MODULES) {
    if (!seen.has(required)) throw new Error(`ForgeOS vendor required module missing from manifest: ${required}`);
    await access(path.join(vendorRoot, required));
  }
  const actualFiles = (await walk(vendorRoot)).map((file) => normalize(path.relative(vendorRoot, file))).sort();
  const manifestFiles = [...seen].sort();
  if (actualFiles.length !== manifestFiles.length || actualFiles.some((file, index) => file !== manifestFiles[index])) throw new Error('ForgeOS vendor file set does not match manifest');
  const digest = rootDigest(manifest.files);
  if (digest !== String(manifest.rootSha256)) throw new Error('ForgeOS vendor root checksum mismatch');
  return Object.freeze({
    schema: 'forge.vendor-verification.v1',
    status: 'pass',
    component: 'ForgeOS',
    version: String(manifest.version),
    files: manifest.files.length,
    rootSha256: digest,
    requiredModules: REQUIRED_MODULES,
  });
}
