import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function copyPath(source, destination, options = {}) {
  await cp(source, destination, { recursive: true, force: true, dereference: true, filter: options.filter });
}

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

export async function buildPortable({ sourceRoot = path.resolve('.'), destination = path.resolve('release/NolaneAgent-portable'), nodeExecutable = process.execPath, launcherExecutable = null, ptyExecutable = null, credentialExecutable = null, platform = process.platform, electronRuntimeBundled = false } = {}) {
  const source = path.resolve(sourceRoot); const target = path.resolve(destination);
  const packageMetadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const version = String(packageMetadata.version);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.join(target, 'app'), { recursive: true });
  await mkdir(path.join(target, 'runtime'), { recursive: true });
  await mkdir(path.join(target, 'data'), { recursive: true });

  await copyPath(path.join(source, 'src'), path.join(target, 'app', 'src'));
  // Release-time inventory/parity audit modules are source evidence, not application runtime.
  await rm(path.join(target, 'app', 'src', 'native-core', 'nolane-native-domain-classifier.mjs'), { force: true });
  await rm(path.join(target, 'app', 'src', 'release'), { recursive: true, force: true });
  await mkdir(path.join(target, 'app', 'src', 'release'), { recursive: true });
  await copyPath(path.join(source, 'src', 'release', 'dependency-preflight-service.mjs'), path.join(target, 'app', 'src', 'release', 'dependency-preflight-service.mjs'));
  await copyPath(path.join(source, 'config', 'product-identity.json'), path.join(target, 'app', 'config', 'product-identity.json'));
  await copyPath(path.join(source, 'config', 'model-families.json'), path.join(target, 'app', 'config', 'model-families.json'));
  await copyPath(path.join(source, 'ui'), path.join(target, 'app', 'ui'));
  try { await stat(path.join(source, 'ui-dist')); await copyPath(path.join(source, 'ui-dist'), path.join(target, 'app', 'ui-dist')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await copyPath(path.join(source, 'desktop'), path.join(target, 'app', 'desktop'));
  await copyPath(path.join(source, 'third_party', 'typescript'), path.join(target, 'app', 'third_party', 'typescript'));
  const forgeRoot = path.join(source, 'vendor', 'forge-os');
  const forgeTarget = path.join(target, 'app', 'vendor', 'forge-os');
  await mkdir(forgeTarget, { recursive: true });
  for (const relative of ['src', 'capabilities-v2', 'providers', 'skills-v2', 'skills', 'config/skill-flow.mjs', 'package.json', 'project-manifest.json', 'LICENSE']) {
    const from = path.join(forgeRoot, relative);
    try { await stat(from); await copyPath(from, path.join(forgeTarget, relative)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const relative of ['vendor/forge-os-upstream.json', 'vendor/forge-os.manifest.json']) {
    const from = path.join(source, relative);
    try { await stat(from); await copyPath(from, path.join(target, 'app', relative)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const relative of ['package.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    const from = path.join(source, relative);
    try { await stat(from); await copyPath(from, path.join(target, 'app', relative)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(path.join(target, 'config'), { recursive: true });
  for (const relative of ['update.example.json', 'update.json', 'nolane-agent-update-public.pem', 'README.md']) {
    const from = path.join(source, 'config', relative);
    try { await stat(from); await copyPath(from, path.join(target, 'config', relative)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const runtimeName = platform === 'win32' ? 'node.exe' : 'node';
  const runtimeBundled = Boolean(nodeExecutable);
  if (runtimeBundled) {
    await copyPath(path.resolve(nodeExecutable), path.join(target, 'runtime', runtimeName));
    if (platform !== 'win32') await chmod(path.join(target, 'runtime', runtimeName), 0o755);
  }
  if (platform === 'win32') await copyPath(path.join(source, 'scripts', 'install-electron-runtime.ps1'), path.join(target, 'Install-Electron-Runtime.ps1'));
  if (ptyExecutable || credentialExecutable) await mkdir(path.join(target, 'app', 'native'), { recursive: true });
  if (ptyExecutable) { const name = platform === 'win32' ? 'NolanePty.exe' : 'NolanePty'; await copyPath(path.resolve(ptyExecutable), path.join(target, 'app', 'native', name)); if (platform !== 'win32') await chmod(path.join(target, 'app', 'native', name), 0o755); }
  if (credentialExecutable) { const name = platform === 'win32' ? 'NolaneCredential.exe' : 'NolaneCredential'; await copyPath(path.resolve(credentialExecutable), path.join(target, 'app', 'native', name)); if (platform !== 'win32') await chmod(path.join(target, 'app', 'native', name), 0o755); }
  if (launcherExecutable) {
    const launcherName = platform === 'win32' ? 'NolaneAgent.exe' : 'NolaneAgent';
    await copyPath(path.resolve(launcherExecutable), path.join(target, launcherName));
    if (platform !== 'win32') await chmod(path.join(target, launcherName), 0o755);
  }

  await writeFile(path.join(target, 'README-PORTABLE.txt'), [
    `Nolane Agent ${version} Portable`,
    '',
    'Run NolaneAgent.exe on Windows. Data is stored in the data directory.',
    'Nolane Agent opens in an Electron desktop window; the agent runtime runs in an isolated utility process.',
    'On first run, the launcher installs the pinned Electron runtime after SHA-256 verification.',
    'The local agent service binds to 127.0.0.1 and uses a random bearer token.',
    'Open Nolane Agent and connect an AI provider before starting the first task.',
    'Codex and Claude authentication stays inside their official CLI login flow.',
    'Direct OpenAI, Anthropic, Gemini and compatible API keys are stored in Windows Credential Manager.',
    'Monaco/xterm assets are optional and loaded only when Technical Details is opened.',
    'Only Nolane-native runtime capabilities are packaged. Historical third-party research inputs are not executable or distributed.',
    'Signed GitHub update metadata is verified before any installer is staged.',
  ].join('\r\n'));

  const files = [];
  for (const file of (await filesUnder(target)).sort()) {
    if (path.basename(file) === 'PORTABLE-MANIFEST.json') continue;
    const info = await stat(file);
    files.push({ path: path.relative(target, file).replaceAll('\\', '/'), bytes: info.size, sha256: await sha256(file) });
  }
  const manifest = { schema: 'nolane.agent.portable.v1', product: 'Nolane Agent', version, platform, nodeRuntime: nodeExecutable ? path.basename(nodeExecutable) : null, runtime: { name: 'Electron', version: '43.2.0', bundled: Boolean(electronRuntimeBundled), bootstrap: platform === 'win32' ? 'Install-Electron-Runtime.ps1' : null, testNodeRuntime: runtimeBundled ? runtimeName : null }, native: { pty: Boolean(ptyExecutable), credential: Boolean(credentialExecutable) }, generatedAt: new Date().toISOString(), files };
  await writeFile(path.join(target, 'PORTABLE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  const manifest = await buildPortable({
    destination: args.get('--destination') ?? path.resolve('release/NolaneAgent-portable'),
    nodeExecutable: args.get('--node') ?? process.execPath,
    platform: args.get('--platform') ?? process.platform,
  });
  console.log(JSON.stringify({ destination: path.resolve(args.get('--destination') ?? 'release/NolaneAgent-portable'), files: manifest.files.length }));
}
