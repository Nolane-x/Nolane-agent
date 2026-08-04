import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sourceRoot = path.resolve(process.argv[2] ?? '.');
const entry = path.join(sourceRoot, 'src', 'app.mjs');
const root = await mkdtemp(path.join(os.tmpdir(), 'forge-smoke-'));
const runtimeFile = path.join(root, 'runtime.json');
const child = spawn(process.execPath, [entry], {
  cwd: sourceRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, FORGE_STUDIO_HOST: '127.0.0.1', FORGE_STUDIO_PORT: '0', FORGE_STUDIO_DATA_DIR: path.join(root, 'data'), FORGE_STUDIO_WORKSPACE: root, FORGE_STUDIO_RUNTIME_FILE: runtimeFile },
});
let stdout = ''; let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk; });
child.stderr.on('data', (chunk) => { stderr += chunk; });
try {
  const deadline = Date.now() + 8_000; let runtime;
  while (Date.now() < deadline) {
    try { runtime = JSON.parse(await readFile(runtimeFile, 'utf8')); break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!runtime) throw new Error(`Runtime handoff timed out\n${stdout}\n${stderr}`);
  const health = await fetch(`${runtime.url}/health`);
  if (!health.ok) throw new Error(`Health failed with ${health.status}`);
  const unauthorized = await fetch(`${runtime.url}/api/projects`);
  if (unauthorized.status !== 401) throw new Error(`Expected API auth guard, received ${unauthorized.status}`);
  const projects = await fetch(`${runtime.url}/api/projects`, { headers: { authorization: `Bearer ${runtime.token}` } });
  if (!projects.ok || !Array.isArray(await projects.json())) throw new Error('Authenticated project API failed');
  console.log(JSON.stringify({ status: 'ok', startup: true, loopback: runtime.url, authGuard: true }));
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await new Promise((resolve) => child.exitCode === null ? child.once('exit', resolve) : resolve());
  await rm(root, { recursive: true, force: true });
}
