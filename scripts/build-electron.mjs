import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ELECTRON_VERSION = '43.2.0';

async function copy(source, destination) { await mkdir(path.dirname(destination), { recursive: true }); await cp(source, destination, { recursive: true, force: true, dereference: true }); }
async function exists(file) { try { await stat(file); return true; } catch { return false; } }
async function filesUnder(root, current = root) {
  const output = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(root, absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}
async function sha256(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }

async function copyNolaneClosure(sourceRoot, appTarget) {
  await copy(path.join(sourceRoot, 'src'), path.join(appTarget, 'src'));
  // Forensic recovery modules are release-time evidence tooling and must never ship in the executable closure.
  await rm(path.join(appTarget, 'src', 'forensics'), { recursive: true, force: true });
  // Inventory generation is release-time audit tooling, not production runtime.
  await rm(path.join(appTarget, 'src', 'native-core', 'nolane-native-domain-classifier.mjs'), { force: true });
  await rm(path.join(appTarget, 'src', 'release'), { recursive: true, force: true });
  await mkdir(path.join(appTarget, 'src', 'release'), { recursive: true });
  await copy(path.join(sourceRoot, 'src', 'release', 'dependency-preflight-service.mjs'), path.join(appTarget, 'src', 'release', 'dependency-preflight-service.mjs'));
  for (const relative of ['ui', 'desktop']) await copy(path.join(sourceRoot, relative), path.join(appTarget, relative));
  // Repository intelligence loads the checked-in TypeScript compiler at runtime;
  // keep this explicit third-party closure in the desktop package.
  await copy(path.join(sourceRoot, 'third_party', 'typescript'), path.join(appTarget, 'third_party', 'typescript'));
  // Runtime boot reads the immutable model-family catalog and release identity
  // alongside product identity; ship the complete non-secret config surface.
  await copy(path.join(sourceRoot, 'config'), path.join(appTarget, 'config'));
  if (await exists(path.join(sourceRoot, 'ui-dist'))) await copy(path.join(sourceRoot, 'ui-dist'), path.join(appTarget, 'ui-dist'));
  for (const relative of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) if (await exists(path.join(sourceRoot, relative))) await copy(path.join(sourceRoot, relative), path.join(appTarget, relative));
  const forgeRoot = path.join(sourceRoot, 'vendor', 'forge-os');
  const forgeTarget = path.join(appTarget, 'vendor', 'forge-os');
  for (const relative of ['src', 'capabilities-v2', 'providers', 'skills-v2', 'skills', 'config/skill-flow.mjs', 'package.json', 'LICENSE']) {
    const from = path.join(forgeRoot, relative);
    if (await exists(from)) await copy(from, path.join(forgeTarget, relative));
  }
  const nativeTarget = path.join(appTarget, 'native');
  for (const [targetName, legacyName] of [['NolanePty.exe', 'ForgePty.exe'], ['NolaneCredential.exe', 'ForgeCredential.exe']]) {
    const candidates = [
      path.join(sourceRoot, '.cache', targetName),
      path.join(sourceRoot, 'native', targetName),
      path.join(sourceRoot, '.cache', legacyName),
      path.join(sourceRoot, 'native', legacyName),
    ];
    for (const candidate of candidates) { if (await exists(candidate)) { await copy(candidate, path.join(nativeTarget, targetName)); break; } }
  }
}

export async function stageElectronWindows({ sourceRoot = path.resolve('.'), electronDist, destination } = {}) {
  const source = path.resolve(sourceRoot);
  const runtime = path.resolve(String(electronDist ?? ''));
  const target = path.resolve(String(destination ?? path.join(source, 'release', 'NolaneAgent-electron-windows-x64')));
  if (!electronDist || !await exists(path.join(runtime, 'electron.exe'))) throw new Error('A verified Electron Windows distribution is required');
  await rm(target, { recursive: true, force: true });
  await copy(runtime, target);
  await rm(path.join(target, 'resources', 'default_app.asar'), { force: true });
  await rm(path.join(target, 'resources', 'default_app'), { recursive: true, force: true });
  await copy(path.join(target, 'electron.exe'), path.join(target, 'NolaneAgent.exe'));
  await rm(path.join(target, 'electron.exe'), { force: true });

  const appTarget = path.join(target, 'resources', 'app');
  await mkdir(appTarget, { recursive: true });
  await copyNolaneClosure(source, appTarget);
  const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const packaged = {
    name: metadata.name,
    productName: 'Nolane Agent',
    version: metadata.version,
    description: metadata.description,
    main: 'desktop/main.cjs',
    type: 'module',
    private: true,
    license: metadata.license,
  };
  await writeFile(path.join(appTarget, 'package.json'), `${JSON.stringify(packaged, null, 2)}\n`);
  await writeFile(path.join(target, 'README.txt'), [
    `Nolane Agent ${metadata.version} Electron`,
    '',
    'Run NolaneAgent.exe.',
    'Nolane Agent runtime runs in an isolated Electron utility process.',
    'User data and credentials are stored outside this application folder.',
  ].join('\r\n'));

  const files = [];
  for (const file of (await filesUnder(target)).sort()) {
    if (path.basename(file) === 'ELECTRON-MANIFEST.json') continue;
    const info = await stat(file);
    files.push({ path: path.relative(target, file).replaceAll('\\', '/'), bytes: info.size, sha256: await sha256(file) });
  }
  const manifest = {
    schema: 'nolane.agent.electron-package.v1',
    product: 'Nolane Agent',
    version: metadata.version,
    platform: 'win32',
    arch: 'x64',
    runtime: { name: 'Electron', version: ELECTRON_VERSION },
    generatedAt: new Date().toISOString(),
    files,
  };
  await writeFile(path.join(target, 'ELECTRON-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  const manifest = await stageElectronWindows({ electronDist: args.get('--electron-dist'), destination: args.get('--destination') });
  console.log(JSON.stringify({ files: manifest.files.length, version: manifest.version }));
}
