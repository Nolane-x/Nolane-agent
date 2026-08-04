import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  t.after(async () => { child.kill('SIGTERM'); await new Promise((resolve) => child.once('exit', resolve)).catch(() => {}); await rm(root, { recursive: true, force: true }); });
  for (let attempt = 0; attempt < 100; attempt += 1) { try { await readFile(runtimeFile); break; } catch { await sleep(25); } }
  const runtime = JSON.parse(await readFile(runtimeFile, 'utf8'));
  let names = await readdir(data);
  for (const name of ['enterprise.db', 'enterprise-sessions.db', 'scim.db', 'cloud-queue.db', 'cloud-sandboxes.db']) assert.equal(names.includes(name), false, `${name} must remain unloaded`);
  const response = await fetch(`${runtime.url}/api/enterprise/audit?organizationId=local`, { headers: { authorization: `Bearer ${runtime.token}` } });
  assert.equal(response.status, 200);
  names = await readdir(data);
  for (const name of ['enterprise.db', 'enterprise-sessions.db', 'scim.db', 'cloud-queue.db', 'cloud-sandboxes.db']) assert.equal(names.includes(name), true, `${name} must appear after activation`);
});
