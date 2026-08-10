import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'release', '.cache', 'coverage', '.forgeos-data', 'dist']);
const REQUIRED_MODULES = Object.freeze(['src/core/canonical-json.mjs', 'src/core/orchestrator.mjs']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value).replaceAll('\\', '/').replace(/^\.\//, '');

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

function rootDigest(files) {
  return sha256(files.map((entry) => `${entry.relativePath}\0${entry.bytes}\0${entry.sha256}\n`).join(''));
}

/** Runtime-safe verification of a complete ForgeOS vendor manifest. */
export async function verifyForgeOsVendor(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const manifest = JSON.parse(await readFile(path.join(root, 'vendor', 'forge-os.manifest.json'), 'utf8'));
  const vendorRoot = path.join(root, 'vendor', 'forge-os');
  if (manifest.schema !== 'forge.vendor-manifest.v1' || manifest.algorithm !== 'sha256' || !Array.isArray(manifest.files)) throw new Error('ForgeOS vendor manifest is invalid');
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
  return Object.freeze({ schema: 'forge.vendor-verification.v1', status: 'pass', component: 'ForgeOS', version: String(manifest.version), files: manifest.files.length, rootSha256: digest, requiredModules: REQUIRED_MODULES });
}
