import { execFile } from 'node:child_process';
import { access, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const LOCK_WAIT_MS = 25;
const LOCK_TIMEOUT_MS = 90_000;
const LOCK_STALE_MS = 120_000;

async function sleep(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }

async function acquireBuildLock(project) {
  const lock = path.join(project, '.forge-vscode-build.lock');
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      await mkdir(lock);
      await writeFile(path.join(lock, 'owner.json'), `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}
`, { mode: 0o600 });
      return async () => { await rm(lock, { recursive: true, force: true }); };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      try {
        const info = await stat(lock);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
          await rm(lock, { recursive: true, force: true });
          continue;
        }
      } catch (inspectError) {
        if (inspectError?.code === 'ENOENT') continue;
        throw inspectError;
      }
      if (Date.now() >= deadline) {
        const timeout = new Error('Timed out waiting for the VS Code build lock');
        timeout.code = 'VSCODE_BUILD_LOCK_TIMEOUT';
        throw timeout;
      }
      await sleep(LOCK_WAIT_MS);
    }
  }
}

export async function buildVsCodeExtension({ rootDir = process.cwd() } = {}) {
  const project = path.resolve(rootDir, 'extensions', 'vscode');
  const config = path.join(project, 'tsconfig.json');
  await access(config);
  const releaseLock = await acquireBuildLock(project);
  try {
    await rm(path.join(project, 'extension', 'dist'), { recursive: true, force: true });
    await mkdir(path.join(project, 'extension', 'dist'), { recursive: true });
    const compiler = process.env.FORGE_TYPESCRIPT_COMPILER || 'tsc';
    const compilerArgs = ['--project', config, '--pretty', 'false'];
    const command = process.platform === 'win32' && /\.mjs$/i.test(compiler) ? process.execPath : compiler;
    const args = command === compiler ? compilerArgs : [compiler, ...compilerArgs];
    const compilerOptions = { cwd: rootDir, timeout: 60_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 };
    try {
      await execFileAsync(command, args, compilerOptions);
    } catch (error) {
      const fallback = path.resolve(rootDir, 'scripts', 'typescript-compiler.mjs');
      if (compiler === 'tsc' && error?.code === 'ENOENT') {
        await access(fallback);
        await execFileAsync(process.execPath, [fallback, config], compilerOptions);
      } else throw error;
    }
    const outputs = [
      path.join(project, 'extension', 'dist', 'client.js'),
      path.join(project, 'extension', 'dist', 'extension.js'),
      path.join(project, 'extension', 'dist', 'local-worktree.js'),
    ];
    for (const output of outputs) await access(output);
    return Object.freeze({ schema: 'forge.studio.vscode-build.v1', outputs: outputs.map((value) => path.relative(rootDir, value)) });
  } finally {
    await releaseLock();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = await buildVsCodeExtension();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
