import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, readlink, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_EXCLUDES = new Set(['.git', '.worktrees', 'release', 'node_modules', 'data']);
const CACHE_PARTS = new Set(['__pycache__', '.pytest_cache', '.mypy_cache']);

function safeRelative(value) {
  const normalized = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('../') || path.isAbsolute(normalized)) throw new TypeError(`Unsafe retention path: ${value}`);
  return normalized;
}

function excluded(relative) {
  const parts = relative.split('/').filter(Boolean);
  if (ROOT_EXCLUDES.has(parts[0])) return true;
  if (parts.some((part) => CACHE_PARTS.has(part))) return true;
  return /\.py[co]$/i.test(relative);
}

async function mirrorTree(sourceRoot, targetRoot, relative = '', avoidRoot = null) {
  await mkdir(targetRoot, { recursive: true });
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (excluded(childRelative)) continue;
    const source = path.join(sourceRoot, entry.name);
    const target = path.join(targetRoot, entry.name);
    if (avoidRoot && (path.resolve(source) === avoidRoot || path.resolve(source).startsWith(`${avoidRoot}${path.sep}`))) continue;
    if (entry.isDirectory()) await mirrorTree(source, target, childRelative, avoidRoot);
    else if (entry.isSymbolicLink()) await symlink(await readlink(source), target);
    else if (entry.isFile()) await copyFile(source, target);
  }
}

async function replaceFile(file, content) {
  await unlink(file).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  await writeFile(file, content, { mode: 0o644 });
}

async function patchJsonVersion(file, version, mutate = (value) => value) {
  const value = mutate(JSON.parse(await readFile(file, 'utf8')));
  value.version = version;
  await replaceFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function prepareLegacyRetentionOverlay({ sourceRoot = process.cwd(), retentionVersion = '4.0.0', overlayRoot } = {}) {
  const root = path.resolve(sourceRoot);
  const target = path.resolve(overlayRoot ?? path.join(path.dirname(root), 'retention-overlays', `${path.basename(root)}-${retentionVersion}`));
  const markerPath = path.join(target, '.nolane-retention-overlay.json');
  const packageBytes = await readFile(path.join(root, 'package.json'));
  const packageMetadata = JSON.parse(packageBytes.toString('utf8'));
  let fingerprintBytes = packageBytes;
  try { fingerprintBytes = await readFile(path.join(root, 'project-manifest.json')); } catch {}
  const sourceFingerprintSha256 = createHash('sha256').update(fingerprintBytes).digest('hex');
  const desiredMarker = { schema: 'nolane.agent.legacy-frontier-retention-overlay.v1', builderVersion: 3, sourceVersion: packageMetadata.version, sourceFingerprintSha256, retentionVersion, sourceRoot: root };
  try {
    const current = JSON.parse(await readFile(markerPath, 'utf8'));
    if (JSON.stringify(current) === JSON.stringify(desiredMarker)) return target;
  } catch {}
  await rm(target, { recursive: true, force: true });
  await mirrorTree(root, target, '', target);
  await patchJsonVersion(path.join(target, 'package.json'), retentionVersion);
  await patchJsonVersion(path.join(target, 'package-lock.json'), retentionVersion, (value) => {
    if (value.packages?.['']) value.packages[''].version = retentionVersion;
    return value;
  });
  for (const relative of ['config/product-identity.json', 'config/release-identity.json']) {
    await patchJsonVersion(path.join(target, relative), retentionVersion, (value) => ({ ...value, channel: 'stable' }));
  }
  const productIdentityModule = path.join(target, 'src/product-identity.mjs');
  try {
    const productIdentitySource = await readFile(productIdentityModule, 'utf8');
    const developmentChecks = [
      String.raw`if (!/^5\.0\.0-alpha\.\d+$/.test(parsed.version)) throw new Error('Nolane Agent development version is invalid');`,
      String.raw`if (!/^5\.0\.0-(?:alpha|beta|rc)\.\d+$/.test(parsed.version)) throw new Error('Nolane Agent prerelease version is invalid');`,
    ];
    const strictDevelopmentCheck = developmentChecks.find((candidate) => productIdentitySource.includes(candidate));
    const retentionCheck = String.raw`if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(parsed.version)) throw new Error('Nolane Agent release version is invalid');`;
    if (!strictDevelopmentCheck) throw new Error('Nolane Agent product identity version guard is missing');
    await replaceFile(productIdentityModule, productIdentitySource.replace(strictDevelopmentCheck, retentionCheck));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await patchJsonVersion(path.join(target, 'extensions/vscode/extension/package.json'), retentionVersion);
  const vsixPath = path.join(target, 'extensions/vscode/extension.vsixmanifest');
  const vsix = await readFile(vsixPath, 'utf8');
  await replaceFile(vsixPath, vsix.replace(/Version="[^"]+"/, `Version="${retentionVersion}"`));
  await mkdir(path.join(target, 'release'), { recursive: true });
  await replaceFile(markerPath, `${JSON.stringify(desiredMarker, null, 2)}\n`);
  return target;
}

export async function runLegacyRetentionGate({ gateScript, sourceRoot = process.cwd(), retentionVersion = '4.0.0', overlayRoot, gateArgs = ['{root}'] } = {}) {
  const script = safeRelative(gateScript);
  if (!script.startsWith('scripts/') || !script.endsWith('.mjs')) throw new TypeError('Legacy retention gate must be a scripts/*.mjs verifier');
  const overlay = await prepareLegacyRetentionOverlay({ sourceRoot, retentionVersion, overlayRoot });
  return await new Promise((resolve, reject) => {
    const resolvedArgs = gateArgs.map((value) => value === '{root}' ? overlay : value === '{version}' ? retentionVersion : String(value));
    const child = spawn(process.execPath, [path.join(overlay, script), ...resolvedArgs], {
      cwd: overlay,
      env: {
        ...process.env,
        TERM: 'dumb',
        GIT_CEILING_DIRECTORIES: path.dirname(overlay),
        NOLANE_AGENT_LEGACY_RETENTION_VERSION: retentionVersion,
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ exitCode: Number.isInteger(code) ? code : 1, signal: signal ?? null, overlay }));
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const gateScript = process.argv[2];
  const sourceRoot = path.resolve(process.argv[3] ?? '.');
  const retentionVersion = process.argv[4] ?? '4.0.0';
  const gateArgs = process.argv.slice(5);
  const result = await runLegacyRetentionGate({ gateScript, sourceRoot, retentionVersion, gateArgs: gateArgs.length ? gateArgs : ['{root}'] });
  process.exitCode = result.exitCode;
}
