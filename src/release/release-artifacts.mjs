import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { loadReleaseNaming, releaseArtifactNames } from './release-naming.mjs';
import { verifyNolaneRuntimePurity } from '../../scripts/lib/nolane-runtime-purity-verifier.mjs';

const execFileAsync = promisify(execFile);
const FORBIDDEN_PACKAGED_AUDIT_EXACT = Object.freeze(['src/native-core/nolane-native-domain-classifier.mjs', 'src/release/nolane-native-core-inventory-verifier.mjs']);
const TRANSIENT_BUILD_PREFIXES = Object.freeze(['extensions/vscode/.forge-vscode-build.lock/']);

async function sha256(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function filesUnder(root, current = root) {
  const output = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(root, absolute));
    else if (entry.isFile()) output.push(absolute);
    else throw new Error(`Unsupported release source entry: ${absolute}`);
  }
  return output;
}
function pythonCommand() { return process.env.NOLANE_AGENT_PYTHON || process.env.FORGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'); }
async function runZipTool(root, mode, spec, archive) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'nolane-release-zip-'));
  try {
    const specPath = path.join(temporary, 'spec.json');
    await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, { mode: 0o600 });
    const { stdout } = await execFileAsync(pythonCommand(), [path.join(root, 'scripts', 'zip-artifacts.py'), mode, specPath, archive], { cwd: root, timeout: 15 * 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(stdout.trim());
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
function assertVersion(value) {
  const version = String(value ?? '');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new TypeError('A semantic release version is required');
  return version;
}
function normalize(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function isTransientBuildPath(relative) {
  const value = normalize(relative);
  return TRANSIENT_BUILD_PREFIXES.some((prefix) => value.startsWith(prefix));
}
function assertRuntimeOwnership(value, label) {
  if (!value || value.product !== 'Nolane Agent' || value.runtime !== 'nolane-native' || value.externalRuntimeBundled !== false || value.externalExecutablePaths !== 0) {
    throw new Error(`${label} has invalid Nolane runtime ownership metadata`);
  }
}

export async function ensureVsCodeReleaseOutputs({ rootDirectory = process.cwd(), requiredFiles = ['client.js', 'extension.js', 'local-worktree.js'] } = {}) {
  const root = path.resolve(rootDirectory);
  const names = [...new Set(requiredFiles.map((value) => normalize(value)))].sort();
  if (names.some((name) => !/^[A-Za-z0-9._/-]+$/.test(name) || name.startsWith('/') || name.includes('..'))) throw new TypeError('VS Code release output paths must be safe relative paths');
  const outputs = names.map((name) => path.join(root, 'extensions', 'vscode', 'extension', 'dist', name));
  if ((await Promise.all(outputs.map(exists))).every(Boolean)) return Object.freeze({ rebuilt: false, outputs: Object.freeze(outputs.map((file) => path.relative(root, file))) });
  const buildScript = path.join(root, 'scripts', 'build-vscode-extension.mjs');
  if (!await exists(buildScript)) throw new Error('VS Code release outputs are missing and the deterministic build script is unavailable');
  await execFileAsync(process.execPath, [buildScript], { cwd: root, timeout: 60_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  for (const output of outputs) await access(output);
  return Object.freeze({ rebuilt: true, outputs: Object.freeze(outputs.map((file) => path.relative(root, file))) });
}

export async function packageReleaseArtifacts({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = assertVersion(version);
  const naming = await loadReleaseNaming({ rootDirectory: root });
  const names = releaseArtifactNames(naming, releaseVersion);
  const release = path.join(root, 'release');
  await mkdir(release, { recursive: true });
  const scoped = path.join(release, `project-manifest-${releaseVersion}.json`);
  const projectManifestPath = await exists(scoped) ? scoped : path.join(root, 'project-manifest.json');
  const projectManifest = JSON.parse(await readFile(projectManifestPath, 'utf8'));
  if (projectManifest.version !== releaseVersion || !Array.isArray(projectManifest.files)) throw new Error('Project manifest version does not match release version');
  const manifestPaths = projectManifest.files.map((entry) => normalize(entry.relativePath));
  const sourcePurity = await verifyNolaneRuntimePurity({ rootDirectory: root });
  if (sourcePurity.status !== 'pass') throw new Error(`Source runtime purity failed: ${sourcePurity.failures.join(', ')}`);

  const vscodeRequiredFiles = new Set(['client.js', 'extension.js']);
  for (const relative of manifestPaths) if (relative.startsWith('extensions/vscode/extension/dist/')) vscodeRequiredFiles.add(relative.slice('extensions/vscode/extension/dist/'.length));
  await ensureVsCodeReleaseOutputs({ rootDirectory: root, requiredFiles: [...vscodeRequiredFiles] });

  const temporary = await mkdtemp(path.join(os.tmpdir(), 'nolane-release-core-'));
  try {
    const coreFiles = projectManifest.files.filter((entry) => {
      const relative = normalize(entry.relativePath);
      return relative && relative !== 'project-manifest.json' && !relative.startsWith('release/') && !isTransientBuildPath(relative);
    });
    for (const entry of coreFiles) await access(path.join(root, normalize(entry.relativePath)));
    const coreManifest = { ...projectManifest, files: coreFiles, runtimeOwnership: { product: 'Nolane Agent', runtime: 'nolane-native', externalRuntimeBundled: false, externalExecutablePaths: 0 }, optionalPacks: [] };
    const coreManifestPath = path.join(temporary, 'project-manifest.json');
    await writeFile(coreManifestPath, `${JSON.stringify(coreManifest, null, 2)}\n`);
    const sourceArchive = path.join(release, names.sourceArchive);
    const entries = coreFiles.map((entry) => ({ source: path.join(root, normalize(entry.relativePath)), archivePath: `${names.sourceRoot}/${normalize(entry.relativePath)}` }));
    entries.push({ source: coreManifestPath, archivePath: `${names.sourceRoot}/project-manifest.json` });
    await runZipTool(root, 'create', { entries }, sourceArchive);

    const vscodeRoot = path.join(root, 'extensions', 'vscode');
    const vsixArchive = path.join(release, names.vscodeArchive);
    const allowed = (await filesUnder(vscodeRoot)).filter((file) => {
      const relative = normalize(path.relative(vscodeRoot, file));
      return relative === '[Content_Types].xml' || relative === 'extension.vsixmanifest' || relative.startsWith('extension/');
    });
    await runZipTool(root, 'create', { entries: allowed.map((file) => ({ source: file, archivePath: normalize(path.relative(vscodeRoot, file)) })) }, vsixArchive);

    const required = [sourceArchive, path.join(release, names.windowsArchive), path.join(release, names.updateArchive), vsixArchive];
    for (const artifact of required) if (!await exists(artifact)) throw new Error(`Required release artifact is missing: ${path.basename(artifact)}`);
    const installer = path.join(release, `NolaneAgent-Setup-${releaseVersion}-x64.exe`);
    const expected = [...required, ...(await exists(installer) ? [installer] : [])];
    const artifacts = [];
    for (const artifact of expected) { const info = await stat(artifact); artifacts.push({ fileName: path.basename(artifact), bytes: info.size, sha256: await sha256(artifact), status: 'ready' }); }

    const gapsPath = path.join(release, `remaining-gaps-${releaseVersion}.json`);
    if (!await exists(gapsPath)) throw new Error(`Required remaining-gaps report is missing: ${path.basename(gapsPath)}`);
    const gaps = JSON.parse(await readFile(gapsPath, 'utf8'));
    if (gaps.productVersion !== releaseVersion || !Number.isInteger(gaps.totalOpen)) throw new Error('Remaining-gaps report is invalid');
    const manifest = {
      schema: naming.manifestSchema, product: naming.product, version: releaseVersion, generatedAt: new Date().toISOString(),
      artifacts, components: {}, runtimeOwnership: { product: 'Nolane Agent', runtime: 'nolane-native', externalRuntimeBundled: false, externalExecutablePaths: 0, attributionFile: 'THIRD_PARTY_NOTICES.md' }, optionalPacks: [],
      remainingGaps: { totalOpen: gaps.totalOpen, summary: gaps.summary, receiptSha256: gaps.receiptSha256 },
      externalGates: [
        { id: 'windows-nsis-build', state: await exists(installer) ? 'satisfied' : 'external-pending', reason: await exists(installer) ? 'Installer present in release directory.' : 'Built by the GitHub Windows release workflow.' },
        { id: 'authenticode', state: process.env.WIN_CSC_LINK ? 'configured' : 'external-pending', reason: 'Requires an organization code-signing certificate and trusted timestamp service.' },
        { id: 'independent-windows-attestation', state: 'external-pending', reason: 'Requires a real Windows runner and published GitHub Release evidence.' },
      ],
    };
    await writeFile(path.join(release, `release-manifest-${releaseVersion}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(path.join(release, `SHA256SUMS-${releaseVersion}.txt`), `${artifacts.map((artifact) => `${artifact.sha256}  ${artifact.fileName}`).join('\n')}\n`);
    return Object.freeze(manifest);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function verifyReleaseArtifacts({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = assertVersion(version);
  const naming = await loadReleaseNaming({ rootDirectory: root });
  const names = releaseArtifactNames(naming, releaseVersion);
  const release = path.join(root, 'release');
  const manifest = JSON.parse(await readFile(path.join(release, `release-manifest-${releaseVersion}.json`), 'utf8'));
  if (manifest.version !== releaseVersion || !Array.isArray(manifest.artifacts) || manifest.artifacts.length < 4 || !Number.isInteger(manifest.remainingGaps?.totalOpen)) throw new Error('Release manifest is invalid');
  assertRuntimeOwnership(manifest.runtimeOwnership, 'Release manifest');
  for (const artifact of manifest.artifacts) { const file = path.join(release, artifact.fileName); const info = await stat(file); if (info.size !== artifact.bytes || await sha256(file) !== artifact.sha256) throw new Error(`Release artifact checksum mismatch: ${artifact.fileName}`); }
  const sourceRoot = names.sourceRoot;
  const windowsRoot = names.windowsRoot;
  const checks = [
    { file: names.sourceArchive, spec: { required: [`${sourceRoot}/package.json`, `${sourceRoot}/package-lock.json`, `${sourceRoot}/src/app.mjs`, `${sourceRoot}/project-manifest.json`, `${sourceRoot}/THIRD_PARTY_NOTICES.md`, `${sourceRoot}/docs/FEATURE-COMPLETENESS-AUDIT-${releaseVersion}.md`, `${sourceRoot}/docs/REMAINING-GAPS-${releaseVersion}.md`, `${sourceRoot}/vendor/forge-os.manifest.json`, `${sourceRoot}/vendor/forge-os/src/core/canonical-json.mjs`, `${sourceRoot}/vendor/forge-os/src/core/orchestrator.mjs`], forbiddenExact: [`${sourceRoot}/.env`], forbiddenPrefixes: [`${sourceRoot}/.git/`, `${sourceRoot}/node_modules/`, `${sourceRoot}/release/`] } },
    { file: names.windowsArchive, spec: { required: [`${windowsRoot}/${names.launcher}`, `${windowsRoot}/app/src/app.mjs`, `${windowsRoot}/PORTABLE-MANIFEST.json`], forbiddenExact: [`${windowsRoot}/app/.env`, ...FORBIDDEN_PACKAGED_AUDIT_EXACT.map((relative) => `${windowsRoot}/app/${relative}`)], forbiddenPrefixes: [`${windowsRoot}/app/.env.`, `${windowsRoot}/app/tests/`, `${windowsRoot}/app/node_modules/`] } },
    { file: names.updateArchive, spec: { required: [names.launcher, 'app/src/app.mjs', 'UPDATE-PAYLOAD-MANIFEST.json'], forbiddenExact: ['app/.env', ...FORBIDDEN_PACKAGED_AUDIT_EXACT.map((relative) => `app/${relative}`)], forbiddenPrefixes: ['app/.env.', 'app/tests/', 'app/node_modules/'] } },
    { file: names.vscodeArchive, spec: { required: ['[Content_Types].xml', 'extension.vsixmanifest', 'extension/package.json', 'extension/dist/client.js', 'extension/dist/extension.js'], forbiddenExact: ['.env'], forbiddenPrefixes: ['src/', 'node_modules/'] } },
  ];
  const archives = [];
  for (const check of checks) archives.push(await runZipTool(root, 'verify', check.spec, path.join(release, check.file)));
  const checksumText = await readFile(path.join(release, `SHA256SUMS-${releaseVersion}.txt`), 'utf8');
  for (const artifact of manifest.artifacts) if (!checksumText.includes(`${artifact.sha256}  ${artifact.fileName}`)) throw new Error(`SHA256SUMS is missing ${artifact.fileName}`);
  const cleanRoom = manifest.certifications?.cleanRoom;
  if (cleanRoom) {
    const reportBytes = await readFile(path.join(release, String(cleanRoom.report ?? '')));
    if (createHash('sha256').update(reportBytes).digest('hex') !== cleanRoom.reportSha256) throw new Error('Clean-room certification report checksum mismatch');
    const report = JSON.parse(reportBytes.toString('utf8'));
    if (report.status !== 'pass') throw new Error('Clean-room certification report identity mismatch');
    assertRuntimeOwnership(report.runtimeOwnership, 'Clean-room certification report');
  }
  const purity = await verifyNolaneRuntimePurity({ rootDirectory: root, archives: checks.map((check) => path.join('release', check.file)) });
  if (purity.status !== 'pass') throw new Error(`Release runtime purity failed: ${purity.failures.join(', ')}`);
  const report = { schema: naming.integritySchema, version: releaseVersion, status: 'pass', verifiedAt: new Date().toISOString(), artifacts: manifest.artifacts, archives, components: {}, runtimeOwnership: manifest.runtimeOwnership, runtimePurityReceiptSha256: purity.receiptSha256 };
  await writeFile(path.join(release, `release-integrity-${releaseVersion}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return Object.freeze(report);
}
