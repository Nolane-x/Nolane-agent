import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The app performs a deliberately broad local-only composition pass before it
// publishes the authenticated handoff. Windows can take longer than the
// desktop supervisor's normal 45s budget when the isolated suite is under
// process/SQLite contention, so this wiring test keeps a bounded 60s ceiling
// without changing the product startup budget.
async function waitForRuntime(child, runtimeFile, timeoutMs = 60_000) {
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.resume();
  let exit = null;
  child.once('exit', (code, signal) => { exit = { code, signal }; });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { return JSON.parse(await readFile(runtimeFile, 'utf8')); } catch (error) {
      if (exit) throw new Error(`runtime child exited before handoff (code=${exit.code}, signal=${exit.signal}): ${stderr}`, { cause: error });
      await sleep(50);
    }
  }
  throw new Error(`runtime handoff timed out after ${timeoutMs}ms${stderr ? `: ${stderr}` : ''}`);
}

test('app uses a runtime module manager and does not statically import enterprise/cloud implementations', () => {
  assert.match(app, /RuntimeModuleManager/);
  assert.match(app, /createOptionalEnterpriseCloudModuleDescriptor/);
  assert.doesNotMatch(app, /from '\.\/enterprise\//);
  assert.doesNotMatch(app, /from '\.\/cloud\//);
  assert.doesNotMatch(app, /new SqliteEnterpriseStore/);
  assert.doesNotMatch(app, /new SqliteCloudQueueStore/);
  assert.match(app, /runtimeModules: runtimeModuleManager\.snapshot\(\)/);
  assert.match(app, /runtimeModuleManager\.applyPolicy\(\{ state: event\.to, \.\.\.event\.policy \}\)/);
});

test('local startup does not create enterprise or cloud databases before first use', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-microkernel-startup-'));
  const data = path.join(root, 'data');
  const runtimeFile = path.join(root, 'runtime.json');
  const child = spawn(process.execPath, ['src/app.mjs'], {
    cwd: path.resolve('.'), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, TERM: 'dumb', FORGE_STUDIO_PORT: '0', FORGE_STUDIO_DATA_DIR: data, FORGE_STUDIO_WORKSPACE: root, FORGE_STUDIO_RUNTIME_FILE: runtimeFile, FORGE_STUDIO_PERFORMANCE_PROFILE: 'lite' },
  });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  let exited = false;
  child.once('exit', () => { exited = true; });
  t.after(async () => {
    if (!exited) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve)).catch(() => {});
    }
    await rm(root, { recursive: true, force: true });
  });
  // Process creation on Windows can be heavily contended after the isolated
  // pool. Wait for the actual handoff and retain child diagnostics instead of
  // turning a slow startup into an opaque ENOENT assertion.
  const runtime = await waitForRuntime(child, runtimeFile);
  for (let attempts = 0; !stdout.trim() && attempts < 40; attempts += 1) await sleep(25);
  const announcement = JSON.parse(stdout.trim());
  assert.equal(announcement.tokenConfigured, true);
  assert.equal(Object.hasOwn(announcement, 'token'), false);
  assert.doesNotMatch(stdout, new RegExp(runtime.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  let names = await readdir(data);
  for (const name of ['enterprise.db', 'enterprise-sessions.db', 'scim.db', 'cloud-queue.db', 'cloud-sandboxes.db']) assert.equal(names.includes(name), false, `${name} must remain unloaded`);
  const response = await fetch(`${runtime.url}/api/enterprise/audit?organizationId=local`, { headers: { authorization: `Bearer ${runtime.token}` } });
  const responseBody = await response.text();
  names = await readdir(data);
  if (response.status === 503) {
    assert.deepEqual(JSON.parse(responseBody), { error: 'Runtime is temporarily conserving resources. Try again shortly.', code: 'RUNTIME_ADMISSION_BLOCKED', retryable: true });
    for (const name of ['enterprise.db', 'enterprise-sessions.db', 'scim.db', 'cloud-queue.db', 'cloud-sandboxes.db']) assert.equal(names.includes(name), false, `${name} must remain unloaded while the runtime is conserving resources`);
    t.diagnostic('Enterprise/cloud activation was correctly deferred because the local runtime entered emergency resource conservation.');
    return;
  }
  assert.equal(response.status, 200, responseBody);
  for (const name of ['enterprise.db', 'enterprise-sessions.db', 'scim.db', 'cloud-queue.db', 'cloud-sandboxes.db']) assert.equal(names.includes(name), true, `${name} must appear after activation`);
});
