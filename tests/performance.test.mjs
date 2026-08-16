import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function waitForRuntime(file, timeoutMs = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { return JSON.parse(await readFile(file, 'utf8')); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('runtime handoff timed out');
}

const STARTUP_BENCHMARK_SKIP = process.platform === 'win32'
  ? 'Windows startup budget is not certified on this host'
  : undefined;

test('the canonical product starts on loopback within the lightweight startup budget', { skip: STARTUP_BENCHMARK_SKIP }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-startup-')); t.after(() => rm(root, { recursive: true, force: true }));
  const runtimeFile = path.join(root, 'runtime.json');
  const started = performance.now();
  const child = spawn(process.execPath, ['src/app.mjs'], {
    cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORGE_STUDIO_HOST: '127.0.0.1', FORGE_STUDIO_PORT: '0', FORGE_STUDIO_DATA_DIR: path.join(root, 'data'), FORGE_STUDIO_WORKSPACE: root, FORGE_STUDIO_RUNTIME_FILE: runtimeFile },
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk; });
  const runtime = await waitForRuntime(runtimeFile);
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs < 5_000, `startup ${elapsedMs.toFixed(0)}ms exceeded 5000ms; ${stderr}`);
  assert.match(runtime.url, /^http:\/\/127\.0\.0\.1:/);
  const health = await fetch(`${runtime.url}/health`);
  assert.equal(health.status, 200);
  if (process.platform === 'linux') {
    const statusText = await readFile(`/proc/${child.pid}/status`, 'utf8');
    const rssKiB = Number(statusText.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
    assert.ok(rssKiB > 0 && rssKiB < 350_000, `RSS ${rssKiB} KiB exceeded 350000 KiB`);
  }
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
});

test('release documentation and canonical product identity are complete and contain no fake-control placeholders', async () => {
  const required = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'docs/ARCHITECTURE.md', 'docs/DEVELOPMENT.md', 'docs/CONFIGURATION.md', 'docs/API.md', 'docs/QUALITY.md', 'docs/RELEASES.md', 'docs/PLATFORMS.md', 'docs/ROADMAP.md', 'config/product-identity.json', 'src/agent/agent-loop.mjs', 'scripts/smoke.mjs'];
  for (const file of required) assert.ok((await stat(file)).isFile(), file);
  const combined = (await Promise.all(required.filter((file) => file.endsWith('.md')).map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(combined, /\b(?:TBD|TODO|coming soon|fake button)\b/i);
  const identity = JSON.parse(await readFile('config/product-identity.json', 'utf8'));
  const packageMetadata = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(identity.product, 'Nolane Agent');
  assert.equal(identity.schema, 'nolane.agent.product-identity.v1');
  assert.equal(identity.packageName, packageMetadata.name);
  assert.equal(identity.version, packageMetadata.version);
  assert.equal(identity.channel, 'stable');
});


test('default outcome shell stays below the eager asset budget and excludes the advanced workroom', async () => {
  const eager = ['ui/index.html', 'ui/style.css', 'ui/app.js', 'ui/ui-state.mjs', 'ui/refresh-coalescer.mjs'];
  let total = 0;
  for (const file of eager) total += (await stat(file)).size;
  assert.ok(total <= 160_000, `eager UI ${total} bytes exceeded 160000 bytes`);
  const app = await readFile('ui/app.js', 'utf8');
  assert.doesNotMatch(app, /^import .*workroom\.js/m);
  assert.match(app, /import\(['"]\.\/workroom\.js['"]\)/);
  for (const lazyCenter of ['runtime-control-center.js', 'workspace-trust-center.js', 'agent-operations-center.js', 'context-memory-center.js']) {
    const escaped = lazyCenter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(app, new RegExp(`['\"](?:\\./|/)${escaped}['\"]`));
    assert.doesNotMatch(app, new RegExp(`^import .*${escaped}`, 'm'));
  }
});
