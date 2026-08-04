import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function copyTree(sourceRoot, destinationRoot, relative = '') {
  const source = path.join(sourceRoot, relative);
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Update payload source contains a symlink: ${relative || '.'}`);
  if (info.isDirectory()) {
    await mkdir(path.join(destinationRoot, relative), { recursive: true, mode: 0o755 });
    for (const entry of await readdir(source, { withFileTypes: true })) await copyTree(sourceRoot, destinationRoot, path.join(relative, entry.name));
    return;
  }
  if (!info.isFile()) throw new Error(`Update payload source contains an unsupported entry: ${relative}`);
  const destination = path.join(destinationRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o755 });
  await copyFile(source, destination);
}

async function filesUnder(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, absolute));
    else if (entry.isFile()) files.push(absolute);
    else throw new Error(`Update payload contains an unsupported entry: ${path.relative(root, absolute)}`);
  }
  return files;
}

export async function stageUpdatePayload({ portableRoot, destination, version } = {}) {
  const source = path.resolve(String(portableRoot ?? ''));
  const target = path.resolve(String(destination ?? ''));
  const releaseVersion = String(version ?? '');
  if (!SEMVER.test(releaseVersion)) throw new TypeError('version must be a semantic version');
  const launcher = path.join(source, 'NolaneAgent.exe');
  const entry = path.join(source, 'app', 'src', 'app.mjs');
  if (!(await stat(launcher).catch(() => null))?.isFile()) throw new Error('Portable package is missing NolaneAgent.exe');
  if (!(await stat(entry).catch(() => null))?.isFile()) throw new Error('Portable package is missing app entry app/src/app.mjs');
  const temporary = `${target}.staging-${process.pid}-${Date.now()}`;
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true, mode: 0o700 });
  try {
    await copyTree(source, temporary, 'app');
    await copyTree(source, temporary, 'NolaneAgent.exe');
    const files = [];
    for (const file of (await filesUnder(temporary)).sort()) {
      const info = await stat(file);
      files.push({ path: path.relative(temporary, file).replaceAll('\\', '/'), bytes: info.size, sha256: await sha256(file) });
    }
    const manifest = {
      schema: 'nolane.agent.update-payload.v1',
      product: 'Nolane Agent',
      version: releaseVersion,
      generatedAt: new Date().toISOString(),
      files,
    };
    await writeFile(path.join(temporary, 'UPDATE-PAYLOAD-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
    await rm(target, { recursive: true, force: true });
    await rename(temporary, target);
    return Object.freeze(manifest);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  stageUpdatePayload({ portableRoot: args.get('--portable'), destination: args.get('--destination'), version: args.get('--version') })
    .then((manifest) => console.log(JSON.stringify({ destination: path.resolve(args.get('--destination')), files: manifest.files.length })))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
